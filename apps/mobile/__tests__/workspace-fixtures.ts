import type { MemoryFact, RecordInput, SourceRecord } from '../src/types/workspace';

// Synthetic acceptance fixtures only; never real personal conversations.
export const syntheticInput: RecordInput = {
  kind: 'text',
  title: '虚构预算沟通',
  body_text: '王总表示项目预算预计为200万元。',
  captured_at: '2026-11-01T10:00:00+08:00',
  timezone: 'Asia/Shanghai',
  consent_confirmed: true,
  people: ['王总'],
  projects: ['虚构甲项目'],
  events: ['预算沟通'],
};
export const syntheticRecord: SourceRecord = {
  ...syntheticInput,
  id: '11111111-1111-4111-8111-111111111111',
  version: 1,
  created_at: '2026-11-01T02:01:00Z',
  updated_at: '2026-11-01T02:01:00Z',
  status: 'active',
};
export const syntheticMemory: MemoryFact = {
  id: '22222222-2222-4222-8222-222222222222',
  source_record_id: syntheticRecord.id,
  source_record_version: 1,
  subject: '王总',
  predicate: 'budget_statement',
  object_text: '项目预算预计为200万元',
  modality: 'estimate',
  status: 'candidate',
  certainty: 'unconfirmed',
  event_time: syntheticInput.captured_at,
  recorded_at: syntheticRecord.created_at,
  version: 1,
  evidence_anchor: {
    start_char: 0,
    end_char: Array.from(syntheticInput.body_text).length,
    quote: syntheticInput.body_text,
  },
};
