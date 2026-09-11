import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson } from "../../lib/output.js";

export function snippetsAddCommand(): Command {
  return new Command("add")
    .description("Add a snippet that expands a spoken trigger into saved text")
    .argument("<trigger>", "Spoken trigger phrase")
    .argument("<replacement>", "Text to insert when the trigger is spoken")
    .action(async (trigger: string, replacement: string, _opts: unknown, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const snippet = await backend.addSnippet({ trigger, replacement });
      printJson(snippet);
    });
}
