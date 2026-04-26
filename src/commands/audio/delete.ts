import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText, shouldPrintJson } from "../../lib/output.js";

interface DeleteOpts {
  format?: string;
}

export function audioDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete the audio file for a transcription (keeps text)")
    .argument("<transcription-id>", "Transcription ID")
    .option("--format <fmt>", "Output format: json|table")
    .action(async (transcriptionId: string, opts: DeleteOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      await backend.deleteAudio(transcriptionId);
      const result = { transcription_id: transcriptionId, audio_deleted: true };
      if (shouldPrintJson(opts.format)) printJson(result);
      else printText(`Deleted audio for transcription ${transcriptionId}.`);
    });
}
