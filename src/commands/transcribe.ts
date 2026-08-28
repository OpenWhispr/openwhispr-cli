import { isAbsolute } from "node:path";
import { Command } from "commander";
import { selectLocalBackend } from "../backends/selector.js";
import type { AudioImportJob, LocalBackend } from "../backends/local.js";
import { userError } from "../lib/errors.js";
import { getGlobalSelectorOpts } from "../lib/global-opts.js";
import { printJson, printText } from "../lib/output.js";

interface TranscribeOpts {
  wait?: boolean;
  format?: string;
}

const TERMINAL_STATUSES = new Set<AudioImportJob["status"]>(["completed", "failed", "cancelled"]);
const DEFAULT_POLL_INTERVAL_MS = 1000;

type JobBackend = Pick<LocalBackend, "submitAudioImportJob" | "getAudioImportJob">;

function formatCompletedText(job: AudioImportJob): string {
  const result = job.result;
  const noteLine = result?.note_id
    ? `Created note ${result.note_id}${result.title ? ` (${result.title})` : ""}`
    : "Import completed, but no note id was returned.";
  return `${noteLine}\n${result?.text ?? ""}`;
}

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

  let job = await backend.submitAudioImportJob(filePath);

  if (!opts.wait) {
    // No --wait: the job has only just been queued, so there is no note/
    // transcript to print yet — always print the job envelope regardless of
    // --format.
    printJson(job);
    return;
  }

  while (!TERMINAL_STATUSES.has(job.status)) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    job = await backend.getAudioImportJob(job.job_id);
  }

  if (job.status === "completed") {
    if (format === "text") {
      printText(formatCompletedText(job));
    } else {
      printJson(job);
    }
    return;
  }

  if (job.status === "cancelled") {
    throw userError(`Audio import job ${job.job_id} was cancelled.`);
  }
  throw userError(job.error || `Audio import job ${job.job_id} failed.`);
}

export function transcribeCommand(): Command {
  return new Command("transcribe")
    .description(
      "Import a local audio file through the running desktop app's normal upload flow, creating a real Personal Notes upload note (local bridge only, never uploads audio; requires --local)"
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
