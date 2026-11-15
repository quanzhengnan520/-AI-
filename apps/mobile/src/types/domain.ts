export type ReviewStatus = 'candidate' | 'verified_by_user' | 'rejected';
export const reviewLabels: Record<ReviewStatus, string> = {
  candidate: '待核实',
  verified_by_user: '人工确认 · 演示',
  rejected: '已驳回 · 演示',
};
export type TaskStatus = 'proposed' | 'confirmed' | 'done';
export interface DemoRecord {
  id: string;
  title: string;
  capturedAt: string;
  body: string;
  tag: string;
  status: 'ready' | 'needs_review';
  audioAvailable: false;
  version: number;
}
export interface Evidence {
  recordId: string;
  startChar: number;
  endChar: number;
}
export interface MemoryFact {
  id: string;
  title: string;
  subject: string;
  category: 'statement' | 'hypothesis';
  status: ReviewStatus;
  recordedAt: string;
  eventTime: string;
  evidence: Evidence;
  version: number;
}
export interface DemoTask {
  id: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
  recordId: string;
}
export interface DemoAnswer {
  answer: string;
  citations: Evidence[];
  certainty: 'supported_with_limits' | 'insufficient_evidence';
  limitations: string;
}
export interface DemoState {
  records: DemoRecord[];
  memories: MemoryFact[];
  tasks: DemoTask[];
  timezone: string;
  retentionDays: number;
  excerptConsent: boolean;
}
