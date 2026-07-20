import "server-only";

export function relativeDate(date: Date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absolute < 60) return formatter.format(seconds, "second");
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (absolute < 604800) return formatter.format(Math.round(seconds / 86400), "day");
  return formatter.format(Math.round(seconds / 604800), "week");
}

export function deriveThreadTitle(content: string) {
  const line = content.trim().split(/\r?\n/, 1)[0] ?? "";
  if (!line) return "New thread";
  return line.length > 70 ? `${line.slice(0, 67).trimEnd()}…` : line;
}
