import { Command } from "commander";
import { readConfig } from "../../lib/config.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface GetOpts {
  format?: string;
}

export function configGetCommand(): Command {
  return new Command("get")
    .description("Print current CLI config (API key redacted)")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: GetOpts) => {
      const config = await readConfig();
      const redacted = {
        backend: config.backend,
        apiBase: config.apiBase,
        apiKey: config.apiKey ? "***" : "",
      };
      if (shouldPrintJson(opts.format)) {
        printJson(redacted);
        return;
      }
      printText(
        [
          `backend  ${redacted.backend}`,
          `apiBase  ${redacted.apiBase}`,
          `apiKey   ${redacted.apiKey || "(unset)"}`,
        ].join("\n")
      );
    });
}
