// Minimal, dependency-free CSV export (opens cleanly in Excel).

function escape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  // Prepend a UTF-8 BOM so Excel renders non-ASCII (Rs., names) correctly.
  return "﻿" + lines.join("\r\n");
}
