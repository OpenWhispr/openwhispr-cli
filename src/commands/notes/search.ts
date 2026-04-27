import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printTable, resolveFormat } from "../../lib/output.js";

interface SearchOpts {
  limit?: string;
  format?: string;
}

export function notesSearchCommand(): Command {
  return new Command("search")
    .description("Search notes")
    .argument("<query>", "Search query")
    .option("--limit <n>", "Max results", "20")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (query: string, opts: SearchOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const limit = opts.limit !== undefined ? Number(opts.limit) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) {
        throw userError("--limit must be a non-negative number.");
      }
      const notes = await backend.searchNotes(query, limit);
      const format = resolveFormat(opts.format);
      if (format === "json") {
        printJson(notes);
      } else {
        printTable(notes, [
          { header: "ID", get: (n) => String(n.id) },
          { header: "Title", get: (n) => n.title ?? "(untitled)" },
          {
            header: "Snippet",
            get: (n) => (n.content ? n.content.slice(0, 60).replace(/\s+/g, " ") : ""),
          },
        ]);
      }
    });
}
