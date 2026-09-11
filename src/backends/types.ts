export type BackendKind = "local" | "remote";

export interface Note {
  id: number | string;
  title?: string | null;
  content?: string;
  enhanced_content?: string | null;
  transcript?: string | null;
  folder_id?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Folder {
  id: number | string;
  name: string;
  sort_order?: number | null;
}

export interface Transcription {
  id: number | string;
  text?: string;
  status?: string;
  created_at?: string;
  duration?: number | null;
}

export interface ListNotesParams {
  folderId?: string;
  limit?: number;
}

export interface CreateNoteParams {
  content: string;
  title?: string;
  folderId?: string;
}

export interface UpdateNoteParams {
  content?: string;
  title?: string;
  folderId?: string;
}

export interface CreateFolderParams {
  name: string;
  sortOrder?: number;
}

export interface ListTranscriptionsParams {
  limit?: number;
}

export interface DictionaryEntry {
  id?: string;
  word: string;
  source?: string;
}

export interface Snippet {
  id?: string;
  trigger: string;
  replacement: string;
}

export interface AddSnippetParams {
  trigger: string;
  replacement: string;
}

export interface TranscribeParams {
  path: string;
  model?: string;
  language?: string;
  prompt?: string;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  durationMs?: number;
  provider?: string;
  model?: string;
  warning?: string;
  beta?: boolean;
}

export interface LocalTranscribeModel {
  provider: string;
  model: string;
  downloaded: boolean;
  default: boolean;
}

export interface Backend {
  readonly kind: BackendKind;
  readonly description: string;

  listNotes(params: ListNotesParams): Promise<Note[]>;
  getNote(id: string): Promise<Note>;
  createNote(params: CreateNoteParams): Promise<Note>;
  updateNote(id: string, params: UpdateNoteParams): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  searchNotes(query: string, limit?: number): Promise<Note[]>;

  listFolders(): Promise<Folder[]>;
  createFolder(params: CreateFolderParams): Promise<Folder>;

  listTranscriptions(params: ListTranscriptionsParams): Promise<Transcription[]>;
  getTranscription(id: string): Promise<Transcription>;
  deleteTranscription(id: string): Promise<void>;

  deleteAudio(transcriptionId: string): Promise<void>;

  listDictionary(): Promise<DictionaryEntry[]>;
  addDictionaryWords(words: string[]): Promise<DictionaryEntry[]>;
  removeDictionaryWords(words: string[]): Promise<number>;

  listSnippets(): Promise<Snippet[]>;
  addSnippet(params: AddSnippetParams): Promise<Snippet>;
  removeSnippets(triggers: string[]): Promise<number>;

  transcribe(params: TranscribeParams): Promise<TranscribeResult>;
}
