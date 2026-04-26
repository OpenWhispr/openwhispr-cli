import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printTable, resolveFormat } from "../../lib/output.js";

interface ListOpts {
  format?: string;
}

export function foldersListCommand(): Command {
  return new Command("list")
    .description("List folders")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: ListOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const folders = await backend.listFolders();
      const format = resolveFormat(opts.format);
      if (format === "json") {
        printJson(folders);
      } else {
        printTable(folders, [
          { header: "ID", get: (f) => String(f.id) },
          { header: "Name", get: (f) => f.name },
          { header: "Sort", get: (f) => (f.sort_order != null ? String(f.sort_order) : "-") },
        ]);
      }
    });
}
