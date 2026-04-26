import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson, printText } from "../../lib/output.js";

interface GetOpts {
  format?: string;
}

export function transcriptionsGetCommand(): Command {
  return new Command("get")
    .description("Get a single transcription by ID")
    .argument("<id>", "Transcription ID")
    .option("--format <fmt>", "Output format: json|text")
    .action(async (id: string, opts: GetOpts, cmd: Command) => {
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const transcription = await backend.getTranscription(id);

      const format = opts.format ?? (process.stdout.isTTY ? "text" : "json");
      if (format === "json") {
        printJson(transcription);
        return;
      }
      if (format === "text") {
        printText(transcription.text ?? "");
        return;
      }
      throw userError(`Invalid --format value: ${format}. Expected json or text.`);
    });
}
