import { userError } from "./errors.js";

export type OutputFormat = "json" | "table";

export function resolveFormat(explicit: string | undefined): OutputFormat {
  if (explicit === undefined) {
    return process.stdout.isTTY ? "table" : "json";
  }
  if (explicit === "json" || explicit === "table") return explicit;
  throw userError(`Invalid --format value: ${explicit}. Expected json or table.`);
}

export function shouldPrintJson(explicit: string | undefined): boolean {
  if (explicit === "json") return true;
  if (explicit === undefined) return !process.stdout.isTTY;
  return false;
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

interface TableColumn<T> {
  header: string;
  get: (row: T) => string;
}

export function printTable<T>(rows: T[], columns: TableColumn<T>[]): void {
  if (rows.length === 0) {
    process.stdout.write("(no results)\n");
    return;
  }
  const widths = columns.map((col) =>
    Math.max(col.header.length, ...rows.map((row) => col.get(row).length))
  );
  const headerLine = columns.map((col, i) => col.header.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  process.stdout.write(`${headerLine}\n${separator}\n`);
  for (const row of rows) {
    const line = columns.map((col, i) => col.get(row).padEnd(widths[i])).join("  ");
    process.stdout.write(`${line}\n`);
  }
}

export function printText(text: string): void {
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}
