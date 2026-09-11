import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printTable, resolveFormat } from "../../lib/output.js";

interface ListOpts {
  format?: string;
}

const MAX_REPLACEMENT_WIDTH = 60;

function truncate(text: string): string {
  const oneLine = text.replace(/\s+/g, " ");
  return oneLine.length > MAX_REPLACEMENT_WIDTH
    ? `${oneLine.slice(0, MAX_REPLACEMENT_WIDTH - 1)}…`
    : oneLine;
}

export function snippetsListCommand(): Command {
  return new Command("list")
    .description("List snippets")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: ListOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const snippets = await backend.listSnippets();
      const format = resolveFormat(opts.format);
      if (format === "json") {
        printJson(snippets);
      } else {
        printTable(snippets, [
          { header: "Trigger", get: (s) => s.trigger },
          { header: "Replacement", get: (s) => truncate(s.replacement) },
        ]);
      }
    });
}
