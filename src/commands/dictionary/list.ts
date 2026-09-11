import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import type { DictionaryEntry } from "../../backends/types.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printTable, resolveFormat } from "../../lib/output.js";

interface ListOpts {
  format?: string;
}

export function dictionaryListCommand(): Command {
  return new Command("list")
    .description("List dictionary words")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: ListOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const entries = await backend.listDictionary();
      const format = resolveFormat(opts.format);
      if (format === "json") {
        printJson(entries);
      } else {
        const columns = [{ header: "Word", get: (e: DictionaryEntry) => e.word }];
        if (entries.some((e) => e.source)) {
          columns.push({ header: "Source", get: (e) => e.source ?? "-" });
        }
        printTable(entries, columns);
      }
    });
}
