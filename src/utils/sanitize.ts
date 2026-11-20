/**
 * Pure data sanitization, local-date formatting, and CSV escaping helpers.
 * Decoupled from Firebase/React so every utility is directly unit-testable via node:test.
 */

/**
 * Removes all keys whose value is `undefined` from an object (shallow + nested plain objects).
 * Prevents Firebase Firestore SDK from throwing `Unsupported field value: undefined`.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value
        .filter(item => item !== undefined)
        .map(item =>
          item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)
            ? stripUndefined(item as Record<string, unknown>)
            : item
        );
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      result[key] = stripUndefined(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Formats a Date object as local YYYY-MM-DD without UTC timezone shifting.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a year, 0-indexed month, and day into a normalized local YYYY-MM-DD string.
 * Correctly handles out-of-range days/months (e.g. month = -1 or day = 0).
 */
export function formatLocalYMD(year: number, monthIndex: number, day: number): string {
  return formatLocalDate(new Date(year, monthIndex, day));
}

/**
 * Escapes a CSV cell according to RFC 4180 and neutralizes spreadsheet formula injection.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
