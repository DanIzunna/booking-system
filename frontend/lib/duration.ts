export function formatDurationSeconds(
  totalSeconds: number | null | undefined,
): string {
  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds === null ||
    totalSeconds === undefined
  ) {
    return "Not configured";
  }

  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (remainingSeconds > 0 && hours === 0 && minutes === 0) {
    parts.push(`${remainingSeconds}s`);
  }

  if (parts.length === 0) {
    return "0m";
  }

  return parts.join(" ");
}

export function formatDurationHuman(
  totalSeconds: number | null | undefined,
): string {
  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds === null ||
    totalSeconds === undefined
  ) {
    return "Not configured";
  }

  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0)
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);

  return parts.length > 0 ? parts.join(" ") : "0 minutes";
}

export function buildFlexibleDurationOptions(
  minimumDuration: number | null | undefined,
  maximumDuration: number | null | undefined,
): number[] {
  const minSeconds = Number(minimumDuration ?? 0);
  const maxSeconds = Number(maximumDuration ?? minSeconds);

  if (
    !Number.isFinite(minSeconds) ||
    !Number.isFinite(maxSeconds) ||
    minSeconds <= 0 ||
    maxSeconds <= 0
  ) {
    return [];
  }

  const options = new Set<number>();
  const stepSeconds = 900;

  for (
    let seconds = minSeconds;
    seconds <= maxSeconds;
    seconds += stepSeconds
  ) {
    options.add(seconds);
  }

  if (!options.has(maxSeconds)) {
    options.add(maxSeconds);
  }

  return [...options].sort((left, right) => left - right);
}
