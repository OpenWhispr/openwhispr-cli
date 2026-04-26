import { Command } from "commander";
import { readConfig } from "../../lib/config.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface StatusOpts {
  format?: string;
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export function authStatusCommand(): Command {
  return new Command("status")
    .description("Show whether an API key is configured")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: StatusOpts) => {
      const config = await readConfig();
      const result = {
        configured: !!config.apiKey,
        api_base: config.apiBase,
        backend: config.backend,
        api_key_preview: maskKey(config.apiKey),
      };
      if (shouldPrintJson(opts.format)) {
        printJson(result);
        return;
      }
      if (result.configured) {
        printText(`API key configured (${result.api_key_preview}) for ${result.api_base}.`);
      } else {
        printText("No API key configured. Run `openwhispr auth login`.");
      }
    });
}
