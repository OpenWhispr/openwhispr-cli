import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface DeleteOpts {
  dryRun?: boolean;
  format?: string;
}

export function transcriptionsDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a transcription (cascades to audio)")
    .argument("<id>", "Transcription ID")
    .option("--dry-run", "Validate without deleting")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (id: string, opts: DeleteOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));

      if (opts.dryRun) {
        await backend.getTranscription(id);
        const result = { id, dry_run: true, would_delete: true };
        if (shouldPrintJson(opts.format)) printJson(result);
        else printText(`Would delete transcription ${id} (and its audio).`);
        return;
      }

      await backend.deleteTranscription(id);
      const result = { id, deleted: true };
      if (shouldPrintJson(opts.format)) printJson(result);
      else printText(`Deleted transcription ${id}.`);
    });
}
