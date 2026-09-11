import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface RemoveOpts {
  format?: string;
}

export function snippetsRemoveCommand(): Command {
  return new Command("remove")
    .description("Remove snippets by trigger")
    .argument("<trigger...>", "Triggers of the snippets to remove")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (triggers: string[], opts: RemoveOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const removed = await backend.removeSnippets(triggers);
      if (shouldPrintJson(opts.format)) printJson({ triggers, removed });
      else printText(`Removed ${removed} snippet${removed === 1 ? "" : "s"}.`);
    });
}
