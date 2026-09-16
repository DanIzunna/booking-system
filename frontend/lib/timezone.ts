const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getParts(value: Date, timeZone: string) {
  const formatter = timeZoneFormatterCache.get(timeZone) ?? new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  timeZoneFormatterCache.set(timeZone, formatter);
  const parts = formatter.formatToParts(value);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: partValue }) => [type, Number(partValue)]));
}

export function localDateTimeToIso(value: string, timeZone: string): string {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(target);
  for (let index = 0; index < 4; index += 1) {
    const parts = getParts(guess, timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess = new Date(guess.getTime() + target - represented);
  }
  return guess.toISOString();
}

export function addLocalMinutes(value: string, minutes: number): string {
  const [date, time] = value.split("T");
  const next = new Date(`${date}T${time}:00Z`);
  next.setUTCMinutes(next.getUTCMinutes() + minutes);
  return `${next.toISOString().slice(0, 10)}T${next.toISOString().slice(11, 16)}`;
}

export function formatZonedDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatLocalTime(value: string | null): string {
  if (!value) return "Unknown time";
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatTimeZoneName(timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" }).formatToParts(new Date()).find(({ type }) => type === "timeZoneName")?.value;
  return name ? `${name} (${timeZone})` : timeZone;
}
