import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AvailabilityException,
  AvailabilityExceptionType,
  AvailabilityWindow,
  AvailabilityWindowType,
} from "@prisma/client";

interface Interval {
  start: Date;
  end: Date;
}

@Injectable()
export class AvailabilityEngineService {
  async intervalsForDate(
    date: string,
    timezone: string,
    windows: AvailabilityWindow[],
    exceptions: AvailabilityException[],
  ) {
    const startAt = localTimeToInstant(date, "00:00", timezone);
    const nextDate = new Date(`${date}T12:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const endAt = localTimeToInstant(
      nextDate.toISOString().slice(0, 10),
      "00:00",
      timezone,
    );
    return (await this.check(startAt, endAt, timezone, windows, exceptions))
      .intervals;
  }

  async check(
    startAt: Date,
    endAt: Date,
    timezone: string,
    windows: AvailabilityWindow[],
    exceptions: AvailabilityException[],
  ) {
    if (startAt >= endAt) {
      throw new BadRequestException("endAt must be after startAt");
    }

    const base = [
      ...specificIntervals(startAt, endAt, windows),
      ...recurringIntervals(startAt, endAt, timezone, windows),
    ];
    const overrides = exceptions
      .filter(
        (exception) => exception.type === AvailabilityExceptionType.OVERRIDE,
      )
      .map(toInterval);
    const blocks = exceptions
      .filter((exception) => exception.type === AvailabilityExceptionType.BLOCK)
      .map(toInterval);

    const effective = subtractIntervals(
      mergeIntervals([...base, ...overrides]),
      blocks,
    );
    const requested = { start: startAt, end: endAt };
    const available = effective.some(
      (interval) =>
        interval.start <= requested.start && interval.end >= requested.end,
    );

    return {
      available,
      startAt,
      endAt,
      intervals: effective
        .filter((interval) => interval.end > startAt && interval.start < endAt)
        .map((interval) => ({
          startAt: new Date(
            Math.max(interval.start.getTime(), startAt.getTime()),
          ),
          endAt: new Date(Math.min(interval.end.getTime(), endAt.getTime())),
        })),
    };
  }
}

function specificIntervals(
  start: Date,
  end: Date,
  windows: AvailabilityWindow[],
): Interval[] {
  return windows
    .filter(
      (window) =>
        window.type === AvailabilityWindowType.SPECIFIC &&
        window.startAt &&
        window.endAt &&
        window.startAt < end &&
        window.endAt > start,
    )
    .map((window) => ({ start: window.startAt!, end: window.endAt! }));
}

function recurringIntervals(
  start: Date,
  end: Date,
  timezone: string,
  windows: AvailabilityWindow[],
): Interval[] {
  const recurring = windows.filter(
    (window) =>
      window.type === AvailabilityWindowType.RECURRING &&
      window.weekday !== null &&
      window.startTime &&
      window.endTime,
  );
  const dates = localDatesBetween(start, end, timezone);
  const intervals: Interval[] = [];

  for (const date of dates) {
    const weekday = weekdayForLocalDate(date, timezone);
    for (const window of recurring) {
      if (window.weekday !== weekday) continue;
      const interval = {
        start: localTimeToInstant(date, window.startTime!, timezone),
        end: localTimeToInstant(date, window.endTime!, timezone),
      };
      if (interval.start < end && interval.end > start)
        intervals.push(interval);
    }
  }
  return intervals;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else if (interval.end > previous.end) {
      previous.end = interval.end;
    }
  }
  return merged;
}

function subtractIntervals(
  available: Interval[],
  blocks: Interval[],
): Interval[] {
  let result = available;
  for (const block of blocks) {
    const next: Interval[] = [];
    for (const interval of result) {
      if (block.end <= interval.start || block.start >= interval.end) {
        next.push(interval);
        continue;
      }
      if (block.start > interval.start)
        next.push({ start: interval.start, end: block.start });
      if (block.end < interval.end)
        next.push({ start: block.end, end: interval.end });
    }
    result = next;
  }
  return mergeIntervals(result);
}

function toInterval(record: AvailabilityException): Interval {
  return { start: record.startAt, end: record.endAt };
}

function localDatesBetween(start: Date, end: Date, timezone: string): string[] {
  const first = localDate(start, timezone);
  const last = localDate(new Date(end.getTime() - 1), timezone);
  const cursor = new Date(`${first}T12:00:00Z`);
  const stop = new Date(`${last}T12:00:00Z`);
  const dates: string[] = [];
  while (cursor <= stop) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function localDate(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function weekdayForLocalDate(date: string, timezone: string): number {
  const instant = localTimeToInstant(date, "12:00", timezone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(instant);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function localTimeToInstant(
  date: string,
  time: string,
  timezone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);
    const values = Object.fromEntries(
      parts
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, Number(value)]),
    );
    const represented = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
    );
    const desired = Date.UTC(year, month - 1, day, hours, minutes);
    guess = new Date(guess.getTime() + desired - represented);
  }
  return guess;
}
