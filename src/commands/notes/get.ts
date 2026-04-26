import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText } from "../../lib/output.js";

interface GetOpts {
  format?: string;
}

export function notesGetCommand(): Command {
  return new Command("get")
    .description("Get a single note by ID")
    .argument("<id>", "Note ID")
    .option("--format <fmt>", "Output format: json|markdown")
    .action(async (id: string, opts: GetOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const note = await backend.getNote(id);

      const format = opts.format ?? (process.stdout.isTTY ? "markdown" : "json");
      if (format === "json") {
        printJson(note);
      } else if (format === "markdown") {
        const title = note.title ? `# ${note.title}\n\n` : "";
        printText(`${title}${note.content ?? ""}`);
      } else {
        throw userError(`Invalid --format value: ${format}. Expected json or markdown.`);
      }
    });
}
