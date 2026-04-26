import { CliError } from "../lib/errors.js";

export function unwrapV1<T>(parsed: unknown): T {
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as { data: T }).data;
  }
  throw new CliError(1, "Malformed response: expected { data } envelope.");
}

export function unwrapV1List<T>(parsed: unknown): T[] {
  if (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    Array.isArray((parsed as { data: unknown }).data)
  ) {
    return (parsed as { data: T[] }).data;
  }
  throw new CliError(1, "Malformed response: expected { data: [...] } envelope.");
}
