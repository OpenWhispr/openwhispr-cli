import { promises as fs } from "node:fs";
import { basename, extname } from "node:path";
import { Command } from "commander";
import { LocalBackend } from "../backends/local.js";
import { selectBackend } from "../backends/selector.js";
import type { Backend, TranscribeResult, TranscribeSegment } from "../backends/types.js";
import { CliError, userError } from "../lib/errors.js";
import { getGlobalSelectorOpts } from "../lib/global-opts.js";
import { printJson, printText } from "../lib/output.js";

interface TranscribeOpts {
  model?: string;
  language?: string;
  prompt?: string;
  format?: string;
  note?: boolean;
  title?: string;
  folder?: string;
}

type TranscribeFormat = "text" | "json" | "srt";

function resolveTranscribeFormat(explicit: string | undefined): TranscribeFormat {
  if (explicit === undefined || explicit === "text") return "text";
  if (explicit === "json" || explicit === "srt") return explicit;
  throw userError(`Invalid --format value: ${explicit}. Expected text, json, or srt.`);
}

async function assertFile(filePath: string): Promise<void> {
  try {
    if ((await fs.stat(filePath)).isFile()) return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    throw userError(`File not found: ${filePath}`);
  }
  throw userError(`Not a file: ${filePath}`);
}

async function resolveFolderId(backend: Backend, name: string): Promise<string> {
  const wanted = name.trim().toLowerCase();
  const folder = (await backend.listFolders()).find((f) => f.name.trim().toLowerCase() === wanted);
  if (!folder) throw userError(`Folder not found: ${name}`);
  return String(folder.id);
}

async function withModelHint(backend: LocalBackend, err: CliError): Promise<CliError> {
  const models = await backend.listTranscribeModels();
  const lines = models.map((m) => {
    const tags = [m.downloaded && "downloaded", m.default && "default"].filter(Boolean);
    return `  ${m.provider}/${m.model}${tags.length ? ` (${tags.join(", ")})` : ""}`;
  });
  return userError(`${err.message}\nAvailable models:\n${lines.join("\n")}`);
}

function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

function toSrt(segments: TranscribeSegment[]): string {
  return segments
    .map(
      (seg, i) => `${i + 1}\n${srtTime(seg.start)} --> ${srtTime(seg.end)}\n${seg.text.trim()}\n`
    )
    .join("\n");
}

function printResult(result: TranscribeResult, format: TranscribeFormat): void {
  if (format === "json") {
    printJson(result);
    return;
  }
  if (format === "srt") {
    if (!result.segments?.length) {
      throw userError("This backend returned no timestamps; use --format text or json.");
    }
    printText(toSrt(result.segments));
    return;
  }
  printText(result.text);
}

export function transcribeCommand(): Command {
  return new Command("transcribe")
    .description("Transcribe an audio file with the desktop app's local models or OpenWhispr Cloud")
    .argument("<file>", "Audio file to transcribe")
    .option("--model <id>", "Local model to use (desktop app only)")
    .option("--language <code>", "Spoken language code, e.g. en")
    .option("--prompt <text>", "Context prompt to bias the transcript (cloud only)")
    .option("--format <fmt>", "Output format: text|json|srt", "text")
    .option("--note", "Save the transcript as a note")
    .option("--title <title>", "Note title (defaults to the file name)")
    .option("--folder <name>", "Folder name for the note")
    .action(async (file: string, opts: TranscribeOpts, cmd: Command) => {
      const format = resolveTranscribeFormat(opts.format);
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
          opts.model &&
          backend instanceof LocalBackend &&
          err instanceof CliError &&
          err.code === "validation_error"
        ) {
          throw await withModelHint(backend, err);
        }
        throw err;
      }

      if (result.beta && format !== "json") {
        process.stderr.write(
          "Cloud transcription through the API is in beta; limits may change.\n"
        );
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
      printResult(result, format);
    });
}
