import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText } from "../../lib/output.js";
import { transcriptToMarkdown } from "../../lib/transcript.js";

interface GetOpts {
  format?: string;
  transcript?: boolean;
}

export function notesGetCommand(): Command {
  return new Command("get")
    .description("Get a single note by ID")
    .argument("<id>", "Note ID")
    .option("--format <fmt>", "Output format: json|markdown")
    .option("--transcript", "Output only the transcript")
    .action(async (id: string, opts: GetOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const note = await backend.getNote(id);

      const format = opts.format ?? (process.stdout.isTTY ? "markdown" : "json");
      if (format !== "json" && format !== "markdown") {
        throw userError(`Invalid --format value: ${format}. Expected json or markdown.`);
      }

      if (opts.transcript) {
        if (format === "json") {
          printJson({ transcript: note.transcript ?? null });
        } else {
          printText(transcriptToMarkdown(note));
        }
        return;
      }

      if (format === "json") {
        printJson(note);
      } else {
        const title = note.title ? `# ${note.title}\n\n` : "";
        printText(`${title}${note.content ?? ""}`);
      }
    });
}
