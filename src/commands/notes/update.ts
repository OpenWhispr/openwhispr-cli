import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson } from "../../lib/output.js";

interface UpdateOpts {
  content?: string;
  title?: string;
  folder?: string;
}

export function notesUpdateCommand(): Command {
  return new Command("update")
    .description("Update a note")
    .argument("<id>", "Note ID")
    .option("--content <text>", "New content")
    .option("--title <t>", "New title")
    .option("--folder <id>", "New folder ID")
    .action(async (id: string, opts: UpdateOpts, cmd: Command) => {
      if (!opts.content && !opts.title && !opts.folder) {
        throw userError("Provide at least one of --content, --title, --folder.");
      }
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const note = await backend.updateNote(id, {
        content: opts.content,
        title: opts.title,
        folderId: opts.folder,
      });
      printJson(note);
    });
}
