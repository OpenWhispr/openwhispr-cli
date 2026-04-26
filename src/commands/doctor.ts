import { Command } from "commander";
import { probeBackends } from "../backends/selector.js";
import { backendUnreachable } from "../lib/errors.js";
import { printJson, printText, shouldPrintJson } from "../lib/output.js";

interface DoctorOpts {
  format?: string;
}

function formatStatus(
  label: string,
  info: { reachable: boolean; description: string; error?: string }
): string {
  const marker = info.reachable ? "[ok]" : "[--]";
  const detail = info.reachable ? "reachable" : (info.error ?? "unreachable");
  return `${marker} ${label}: ${info.description} — ${detail}`;
}

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnose CLI connectivity to local and remote backends")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: DoctorOpts) => {
      const result = await probeBackends();

      if (shouldPrintJson(opts.format)) {
        printJson(result);
      } else {
        printText(
          [formatStatus("local ", result.local), formatStatus("remote", result.remote)].join("\n")
        );
      }

      if (!result.local.reachable && !result.remote.reachable) {
        throw backendUnreachable(
          "Neither backend is reachable. Start the desktop app or run `openwhispr auth login`."
        );
      }
    });
}
