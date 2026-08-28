import type { BridgeFile } from "../lib/config.js";
import { userError } from "../lib/errors.js";
import { HttpClient } from "../lib/http.js";
import type {
  Backend,
  CreateFolderParams,
  CreateNoteParams,
  Folder,
  ListNotesParams,
  ListTranscriptionsParams,
  Note,
  Transcription,
  UpdateNoteParams,
} from "./types.js";
import { unwrapV1, unwrapV1List } from "./v1-envelope.js";

// POC-only job shape returned by the desktop bridge's /v1/audio-import-jobs
// routes (see cliAudioImportBridge.js). Not part of the shared Backend
// interface: this pathway only exists on the local bridge, with no cloud
// equivalent, so RemoteBackend intentionally has no matching methods.
//
// Unlike a raw transcription job, this drives the desktop app's real,
// visible upload-note flow (transcribeFileWithSpeakers -> saveUploadNote):
// a completed job's result references the note it created, the same note a
// user would see by importing the file through the UI.
export interface AudioImportJobResult {
  note_id?: string | null;
  title?: string | null;
  text?: string | null;
  duration_seconds?: number | null;
}

export type AudioImportJobStatus = "queued" | "transcribing" | "completed" | "failed" | "cancelled";

export interface AudioImportJob {
  job_id: string;
  status: AudioImportJobStatus;
  stage: string;
  progress: number;
  created_at?: string;
  updated_at?: string;
  result?: AudioImportJobResult | null;
  error?: string | null;
}

export interface AudioImportJobCancelResult {
  job: AudioImportJob;
  cancelled: boolean;
  already_terminal?: boolean;
  cancellation_requested?: boolean;
}

export class LocalBackend implements Backend {
  readonly kind = "local" as const;
  readonly description: string;
  private readonly http: HttpClient;

  constructor(bridge: BridgeFile) {
    this.description = `local desktop bridge (127.0.0.1:${bridge.port})`;
    this.http = new HttpClient({
      baseUrl: `http://127.0.0.1:${bridge.port}`,
      authToken: bridge.token,
      unreachableLabel: "Local desktop bridge unreachable",
      authLabel: "Local bridge auth failed",
      serverErrorLabel: "Local bridge error",
      defaultTimeoutMs: 10_000,
    });
  }

  async ping(timeoutMs = 1500): Promise<boolean> {
    try {
      const res = await this.http.fetchRaw({ method: "GET", path: "/v1/health" }, timeoutMs);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async listNotes(params: ListNotesParams): Promise<Note[]> {
    return unwrapV1List<Note>(
      await this.http.request({
        method: "GET",
        path: "/v1/notes/list",
        query: { folder_id: params.folderId, limit: params.limit },
      })
    );
  }

  async getNote(id: string): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({ method: "GET", path: `/v1/notes/${encodeURIComponent(id)}` })
    );
  }

  async createNote(params: CreateNoteParams): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({
        method: "POST",
        path: "/v1/notes/create",
        body: {
          content: params.content,
          title: params.title,
          folder_id: params.folderId,
        },
      })
    );
  }

  async updateNote(id: string, params: UpdateNoteParams): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({
        method: "PATCH",
        path: `/v1/notes/${encodeURIComponent(id)}`,
        body: {
          content: params.content,
          title: params.title,
          folder_id: params.folderId,
        },
      })
    );
  }

  async deleteNote(id: string): Promise<void> {
    await this.http.request({ method: "DELETE", path: `/v1/notes/${encodeURIComponent(id)}` });
  }

  async searchNotes(query: string, limit?: number): Promise<Note[]> {
    if (!query) throw userError("Search query is required.");
    return unwrapV1List<Note>(
      await this.http.request({
        method: "GET",
        path: "/v1/notes/search",
        query: { q: query, limit },
      })
    );
  }

  async listFolders(): Promise<Folder[]> {
    return unwrapV1List<Folder>(
      await this.http.request({ method: "GET", path: "/v1/folders/list" })
    );
  }

  async createFolder(params: CreateFolderParams): Promise<Folder> {
    return unwrapV1<Folder>(
      await this.http.request({
        method: "POST",
        path: "/v1/folders/create",
        body: { name: params.name, sort_order: params.sortOrder },
      })
    );
  }

  async listTranscriptions(params: ListTranscriptionsParams): Promise<Transcription[]> {
    return unwrapV1List<Transcription>(
      await this.http.request({
        method: "GET",
        path: "/v1/transcriptions/list",
        query: { limit: params.limit },
      })
    );
  }

  async getTranscription(id: string): Promise<Transcription> {
    return unwrapV1<Transcription>(
      await this.http.request({
        method: "GET",
        path: `/v1/transcriptions/${encodeURIComponent(id)}`,
      })
    );
  }

  async deleteTranscription(id: string): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: `/v1/transcriptions/${encodeURIComponent(id)}`,
    });
  }

  async deleteAudio(transcriptionId: string): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: `/v1/transcriptions/${encodeURIComponent(transcriptionId)}/audio`,
    });
  }

  // POC: async job wrapper around the desktop app's real upload-note import
  // flow. Local-only — there is no remote/cloud equivalent, so these are not
  // part of the shared Backend interface (see the POC types above).
  async submitAudioImportJob(path: string): Promise<AudioImportJob> {
    return unwrapV1<AudioImportJob>(
      await this.http.request({
        method: "POST",
        path: "/v1/audio-import-jobs",
        body: { path },
      })
    );
  }

  async getAudioImportJob(jobId: string): Promise<AudioImportJob> {
    return unwrapV1<AudioImportJob>(
      await this.http.request({
        method: "GET",
        path: `/v1/audio-import-jobs/${encodeURIComponent(jobId)}`,
      })
    );
  }

  async cancelAudioImportJob(jobId: string): Promise<AudioImportJobCancelResult> {
    return unwrapV1<AudioImportJobCancelResult>(
      await this.http.request({
        method: "DELETE",
        path: `/v1/audio-import-jobs/${encodeURIComponent(jobId)}`,
      })
    );
  }
}
