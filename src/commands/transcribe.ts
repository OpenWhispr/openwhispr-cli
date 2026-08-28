import { isAbsolute } from "node:path";
import { Command } from "commander";
import { selectLocalBackend } from "../backends/selector.js";
import type { LocalBackend, TranscriptionJob } from "../backends/local.js";
import { userError } from "../lib/errors.js";
import { getGlobalSelectorOpts } from "../lib/global-opts.js";
import { printJson, printText } from "../lib/output.js";

interface TranscribeOpts {
  wait?: boolean;
  format?: string;
}

const TERMINAL_STATUSES = new Set<TranscriptionJob["status"]>([
  "completed",
  "failed",
  "cancelled",
]);
const DEFAULT_POLL_INTERVAL_MS = 1000;

type JobBackend = Pick<LocalBackend, "submitTranscriptionJob" | "getTranscriptionJob">;

// Split from the Command factory so it can be exercised directly against a
// mocked backend, without touching the real ~/.openwhispr bridge file.
export async function runTranscribe(
  backend: JobBackend,
  filePath: string,
  opts: TranscribeOpts,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
): Promise<void> {
  const format = opts.format ?? (process.stdout.isTTY ? "text" : "json");
  if (format !== "json" && format !== "text") {
    throw userError(`Invalid --format value: ${opts.format}. Expected json or text.`);
  }

  let job = await backend.submitTranscriptionJob(filePath);

  if (!opts.wait) {
    // No --wait: the job has only just been queued, so there is no transcript
    // to print yet — always print the job envelope regardless of --format.
    printJson(job);
    return;
  }

  while (!TERMINAL_STATUSES.has(job.status)) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    job = await backend.getTranscriptionJob(job.job_id);
  }

  if (job.status === "completed") {
    if (format === "text") {
      printText(job.result?.text ?? "");
    } else {
      printJson(job);
    }
    return;
  }

  if (job.status === "cancelled") {
    throw userError(`Transcription job ${job.job_id} was cancelled.`);
  }
  throw userError(job.error || `Transcription job ${job.job_id} failed.`);
}

export function transcribeCommand(): Command {
  return new Command("transcribe")
    .description(
      "Transcribe a local audio file through the desktop app's local model/engine (local bridge only, never uploads audio)"
    )
    .argument("<path>", "Absolute path to a local audio file")
    .option("--wait", "Poll the job until it finishes, then print the result")
    .option(
      "--format <fmt>",
      "With --wait, output format for the finished job: json|text (default: text in a TTY, json otherwise)"
    )
    .action(async (filePath: string, opts: TranscribeOpts, cmd: Command) => {
      const globalOpts = getGlobalSelectorOpts(cmd);
      if (globalOpts.remote) {
        throw userError(
          "openwhispr transcribe only supports the local desktop bridge; do not pass --remote."
        );
      }
      if (!isAbsolute(filePath)) {
        throw userError(`<path> must be an absolute path, got: ${filePath}`);
      }
      const backend = await selectLocalBackend(globalOpts);
      await runTranscribe(backend, filePath, opts);
    });
}
