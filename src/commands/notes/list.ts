import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printTable, resolveFormat } from "../../lib/output.js";

interface ListOpts {
  folder?: string;
  limit?: string;
  format?: string;
}

export function notesListCommand(): Command {
  return new Command("list")
    .description("List notes")
    .option("--folder <id>", "Filter by folder ID")
    .option("--limit <n>", "Max results", "50")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: ListOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const limit = opts.limit !== undefined ? Number(opts.limit) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) {
        throw userError("--limit must be a non-negative number.");
      }
      const notes = await backend.listNotes({ folderId: opts.folder, limit });
      const format = resolveFormat(opts.format);
      if (format === "json") {
        printJson(notes);
      } else {
        printTable(notes, [
          { header: "ID", get: (n) => String(n.id) },
          { header: "Title", get: (n) => n.title ?? "(untitled)" },
          { header: "Folder", get: (n) => (n.folder_id != null ? String(n.folder_id) : "-") },
          { header: "Updated", get: (n) => n.updated_at ?? "-" },
        ]);
      }
    });
}
