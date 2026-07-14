import type { Note } from "../backends/types.js";

export interface TranscriptSegment {
  text?: string;
  source?: string;
  timestamp?: number;
  speaker?: string;
  speakerName?: string;
  speakerIsPlaceholder?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSegment(value: unknown): TranscriptSegment {
  if (!isRecord(value)) return {};
  const segment: TranscriptSegment = {};
  if (typeof value.text === "string") segment.text = value.text;
  if (typeof value.source === "string") segment.source = value.source;
  if (typeof value.timestamp === "number") segment.timestamp = value.timestamp;
  if (typeof value.speaker === "string") segment.speaker = value.speaker;
  if (typeof value.speakerName === "string") segment.speakerName = value.speakerName;
  if (typeof value.speakerIsPlaceholder === "boolean") {
    segment.speakerIsPlaceholder = value.speakerIsPlaceholder;
  }
  return segment;
}

/**
 * Returns the transcript segments when `raw` is already an array, or a JSON string
 * that parses to an array. Returns `null` otherwise, signalling "not structured —
 * render the raw value instead".
 */
export function parseTranscript(raw: unknown): TranscriptSegment[] | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  return value.map(toSegment);
}

// Stored timestamps are either epoch milliseconds or elapsed seconds; the
// desktop app distinguishes them with the same > 1e9 heuristic.
function formatTime(timestamp: number | undefined): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  const pad = (n: number): string => String(n).padStart(2, "0");
  if (timestamp > 1e9) {
    const date = new Date(timestamp);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  const s = Math.floor(timestamp);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// Matches the desktop app's 1-indexed rendering: speaker_0 → "Speaker 1".
function prettifySpeaker(id: string): string {
  const num = Number.parseInt(id.replace("speaker_", ""), 10);
  if (!Number.isNaN(num)) return `Speaker ${num + 1}`;
  return id
    .split("_")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function label(segment: TranscriptSegment): string {
  if (segment.source === "mic") return "Me";
  if (segment.speakerName && !segment.speakerIsPlaceholder) return segment.speakerName;
  if (segment.speaker) return prettifySpeaker(segment.speaker);
  return "Speaker";
}

/**
 * Renders a note's transcript as a clean, speaker-labeled markdown blob. Falls back to
 * the raw transcript string when the transcript isn't structured segments.
 */
export function transcriptToMarkdown(note: Note): string {
  const heading = note.title ? `# ${note.title}\n\n` : "";
  const segments = parseTranscript(note.transcript);
  if (segments === null) {
    return `${heading}${note.transcript ?? ""}`;
  }

  const lines = segments.map((segment) => {
    const time = formatTime(segment.timestamp);
    const stamp = time ? ` *(${time})*` : "";
    return `**${label(segment)}**${stamp}: ${segment.text ?? ""}`;
  });

  return `${heading}## Transcript\n\n${lines.join("\n\n")}`;
}
