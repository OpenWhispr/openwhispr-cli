import { promises as fs } from "node:fs";
import { basename, extname } from "node:path";
import { Command } from "commander";
import { LocalBackend } from "../backends/local.js";
import { selectBackend } from "../backends/selector.js";
import type { Backend, TranscribeResult } from "../backends/types.js";
import { CliError, notFound, userError } from "../lib/errors.js";
import { getGlobalSelectorOpts } from "../lib/global-opts.js";
import { printJson, printText } from "../lib/output.js";

interface TranscribeOpts {
  model?: string;
  language?: string;
  prompt?: string;
  format: string;
  note?: boolean;
  title?: string;
  folder?: string;
}

function resolveTranscribeFormat(explicit: string): "text" | "json" {
  if (explicit === "text" || explicit === "json") return explicit;
  throw userError(`Invalid --format value: ${explicit}. Expected text or json.`);
}

async function assertFile(filePath: string): Promise<void> {
  try {
    if ((await fs.stat(filePath)).isFile()) return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    throw userError(`File not found: ${filePath}. Check the path and try again.`);
  }
  throw userError(`${filePath} is not a file. Pass the path of an audio file.`);
}

async function resolveFolderId(backend: Backend, name: string): Promise<string> {
  const wanted = name.trim().toLowerCase();
  const folder = (await backend.listFolders()).find((f) => f.name.trim().toLowerCase() === wanted);
  if (!folder) {
    throw notFound(
      `Folder not found: ${name}. Run \`openwhispr folders list\` to see folder names.`
    );
  }
  return String(folder.id);
}

async function withModelHint(backend: LocalBackend, err: CliError): Promise<CliError> {
  const lines = (await backend.listTranscribeModels()).map((m) => {
    const tags = [m.provider, m.downloaded && "downloaded", m.default && "default"].filter(Boolean);
    return `  ${m.model} (${tags.join(", ")})`;
  });
  return userError(`${err.message}\nModels for --model:\n${lines.join("\n")}`);
}

export function transcribeCommand(): Command {
  return new Command("transcribe")
    .description(
      "Transcribe an audio file with the desktop app's local models (free, no size limit), or with OpenWhispr Cloud via --remote (beta: Pro/Business, 4 MB per request, 600 minutes per month, larger files split with ffmpeg)"
    )
    .argument("<file>", "Audio file to transcribe")
    .option("--model <id>", "Local model to use (desktop app only)")
    .option("--language <code>", "Spoken language code, e.g. en")
    .option("--prompt <text>", "Context prompt to bias the transcript (cloud only)")
    .option("--format <fmt>", "Output format: text|json", "text")
    .option("--note", "Save the transcript as a note")
    .option("--title <title>", "Note title (defaults to the file name)")
    .option("--folder <name>", "Folder name for the note")
    .action(async (file: string, opts: TranscribeOpts, cmd: Command) => {
      const format = resolveTranscribeFormat(opts.format);
      if ((opts.title || opts.folder) && !opts.note) {
        throw userError("--title and --folder only apply when saving with --note.");
      }
      await assertFile(file);

      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const folderId = opts.folder ? await resolveFolderId(backend, opts.folder) : undefined;

      let result: TranscribeResult;
      try {
        result = await backend.transcribe({
          path: file,
          model: opts.model,
          language: opts.language,
          prompt: opts.prompt,
        });
      } catch (err) {
        if (
          backend instanceof LocalBackend &&
          err instanceof CliError &&
          err.code === "validation_error"
        ) {
          throw await withModelHint(backend, err);
        }
        throw err;
      }

      if (format !== "json") {
        if (result.warning) process.stderr.write(`${result.warning}\n`);
        if (result.beta) {
          process.stderr.write(
            "Cloud transcription through the API is in beta; limits may change.\n"
          );
        }
      }

      if (opts.note) {
        const note = await backend.createNote({
          content: result.text,
          title: opts.title ?? basename(file, extname(file)),
          folderId,
        });
        printJson(note);
        return;
      }
      if (format === "json") {
        printJson(result);
        return;
      }
      printText(result.text);
    });
}
