/**
 * Format a Date for use as <input type="datetime-local"> defaultValue.
 * The input expects "YYYY-MM-DDTHH:mm" in the user's local time.
 */
export function toLocalInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
