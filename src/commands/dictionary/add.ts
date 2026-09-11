import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson } from "../../lib/output.js";

export function dictionaryAddCommand(): Command {
  return new Command("add")
    .description("Add words to the dictionary")
    .argument("<word...>", "Words to add")
    .action(async (words: string[], _opts: unknown, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const entries = await backend.addDictionaryWords(words);
      printJson(entries);
    });
}
