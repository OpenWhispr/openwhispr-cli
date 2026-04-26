import { promises as fs } from "node:fs";
import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson } from "../../lib/output.js";

interface CreateOpts {
  content?: string;
  contentFile?: string;
  title?: string;
  folder?: string;
  sourceTranscription?: string;
}

export function notesCreateCommand(): Command {
  return new Command("create")
    .description("Create a new note")
    .option("--content <text>", "Note content as a string")
    .option("--content-file <path>", "Read note content from a file")
    .option("--title <t>", "Note title")
    .option("--folder <id>", "Target folder ID")
    .option("--source-transcription <id>", "Link to source transcription ID")
    .action(async (opts: CreateOpts, cmd: Command) => {
      if (!opts.content && !opts.contentFile) {
        throw userError("Provide --content or --content-file.");
      }
      if (opts.content && opts.contentFile) {
        throw userError("Use --content or --content-file, not both.");
      }
      const content = opts.content ?? (await fs.readFile(opts.contentFile as string, "utf8"));

      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const note = await backend.createNote({
        content,
        title: opts.title,
        folderId: opts.folder,
        sourceTranscriptionId: opts.sourceTranscription,
      });
      printJson(note);
    });
}
