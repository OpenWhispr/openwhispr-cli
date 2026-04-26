import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printTable, resolveFormat } from "../../lib/output.js";

interface ListOpts {
  limit?: string;
  format?: string;
}

export function transcriptionsListCommand(): Command {
  return new Command("list")
    .description("List transcriptions")
    .option("--limit <n>", "Max results", "50")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: ListOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const limit = opts.limit !== undefined ? Number(opts.limit) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) {
        throw userError("--limit must be a non-negative number.");
      }
      const items = await backend.listTranscriptions({ limit });
      const format = resolveFormat(opts.format);
      if (format === "json") {
        printJson(items);
      } else {
        printTable(items, [
          { header: "ID", get: (t) => String(t.id) },
          { header: "Status", get: (t) => t.status ?? "-" },
          {
            header: "Duration",
            get: (t) => (t.duration != null ? `${t.duration}s` : "-"),
          },
          { header: "Created", get: (t) => t.created_at ?? "-" },
        ]);
      }
    });
}
