export interface RecordInput {
  kind: 'text';
  title: string;
  body_text: string;
  captured_at: string;
  timezone: string;
  consent_confirmed: boolean;
  people: string[];
  projects: string[];
  events: string[];
}
export interface SourceRecord extends RecordInput {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
  status: string;
}
export interface MemoryFact {
  id: string;
  source_record_id: string;
  source_record_version: number;
  subject: string;
  predicate: string;
  object_text: string;
  modality: string;
  status: string;
  certainty: string;
  event_time: string | null;
  recorded_at: string;
  version: number;
  evidence_anchor: { start_char: number; end_char: number; quote: string };
}
export interface Citation {
  record_id: string;
  record_version: number;
  start_char: number;
  end_char: number;
  quote: string;
  captured_at: string;
  status: string;
}
export interface QueryAnswer {
  answer: string;
  certainty: string;
  citations: Citation[];
  limitations: string[];
}
export interface PageResult<T> {
  items: T[];
  next_cursor: string | null;
}
export interface DeviceSession {
  device_id: string;
  device_token: string;
}
export interface ApiMetadata {
  llm_provider?: string;
  live_ai_enabled?: boolean;
  llm_host?: string | null;
  mode?: string;
}
export interface Draft {
  id: string;
  origin: string;
  input: RecordInput;
  status: 'draft' | 'queued';
  error?: string;
}

// Persist/send only fields accepted by the record input contract.
export function recordInput(value: RecordInput): RecordInput {
  return {
    kind: 'text',
    title: value.title,
    body_text: value.body_text,
    captured_at: value.captured_at,
    timezone: value.timezone,
    consent_confirmed: value.consent_confirmed,
    people: [...value.people],
    projects: [...value.projects],
    events: [...value.events],
  };
}
