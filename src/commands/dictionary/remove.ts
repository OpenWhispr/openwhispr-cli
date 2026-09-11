import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface RemoveOpts {
  format?: string;
}

export function dictionaryRemoveCommand(): Command {
  return new Command("remove")
    .description("Remove words from the dictionary")
    .argument("<word...>", "Words to remove")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (words: string[], opts: RemoveOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const removed = await backend.removeDictionaryWords(words);
      if (shouldPrintJson(opts.format)) printJson({ words, removed });
      else printText(`Removed ${removed} dictionary word${removed === 1 ? "" : "s"}.`);
    });
}
