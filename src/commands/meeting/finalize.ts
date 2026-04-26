import { promises as fs } from "node:fs";
import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface FinalizeOpts {
  transcription?: string;
  folder?: string;
  contentFile?: string;
  title?: string;
  dryRun?: boolean;
  format?: string;
}

export function meetingFinalizeCommand(): Command {
  return new Command("finalize")
    .description("Finalize a meeting: write note in folder, then delete transcription + audio")
    .requiredOption("--transcription <id>", "Source transcription ID")
    .requiredOption("--folder <id>", "Target folder ID for the note")
    .requiredOption("--content-file <path>", "Path to file with processed note content")
    .option("--title <t>", "Note title")
    .option("--dry-run", "Validate without mutating anything")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (opts: FinalizeOpts, cmd: Command) => {
      const content = await fs.readFile(opts.contentFile as string, "utf8");
      if (!content.trim()) {
        throw userError("Content file is empty.");
      }

      const backend = await selectBackend(getGlobalSelectorOpts(cmd));

      const result = await backend.finalizeMeeting({
        transcriptionId: opts.transcription as string,
        folderId: opts.folder as string,
        content,
        title: opts.title,
        dryRun: opts.dryRun ?? false,
      });

      if (shouldPrintJson(opts.format)) {
        printJson(result);
        return;
      }
      const verb = result.dry_run ? "Would finalize" : "Finalized";
      const noteFragment = result.note_id != null ? `, note=${result.note_id}` : "";
      printText(`${verb} meeting: transcription=${result.transcription_id}${noteFragment}.`);
    });
}
