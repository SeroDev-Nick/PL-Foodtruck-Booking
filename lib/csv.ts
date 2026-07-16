/**
 * CSV helpers with formula-injection protection.
 *
 * Spreadsheet apps treat a leading =, +, -, or @ (and some whitespace/control
 * variants) as the start of a formula. Any user-supplied text must be neutralized
 * before it is written to a CSV so an opened file cannot execute a formula.
 */

const INJECTION_PREFIXES = ["=", "+", "-", "@"];
// Tab, carriage return, and line feed can also lead a formula in some apps.
const RISKY_LEADING_CONTROL = ["\t", "\r", "\n"];

/**
 * Neutralizes a single cell's text so spreadsheet apps never run it as a formula,
 * then escapes it for CSV. Apply to every user-supplied text field.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  const firstChar = text.charAt(0);
  if (
    INJECTION_PREFIXES.includes(firstChar) ||
    RISKY_LEADING_CONTROL.includes(firstChar)
  ) {
    // Leading apostrophe forces text interpretation in Excel/Sheets/LibreOffice.
    text = `'${text}`;
  }

  return escapeCsvField(text);
}

/** RFC-4180 field escaping: wrap in quotes when needed, double interior quotes. */
function escapeCsvField(text: string): string {
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Builds a CSV string. Every cell is run through sanitizeCsvCell, including
 * headers, so the whole file is consistently protected and escaped.
 */
export function buildCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const lines: string[] = [];
  lines.push(headers.map(sanitizeCsvCell).join(","));
  for (const row of rows) {
    lines.push(row.map(sanitizeCsvCell).join(","));
  }
  // Trailing newline keeps POSIX tools happy; CRLF matches RFC-4180.
  return lines.join("\r\n") + "\r\n";
}
