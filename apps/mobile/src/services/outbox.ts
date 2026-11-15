import type { Draft, RecordInput, SourceRecord } from '../types/workspace';
import { recordInput } from '../types/workspace';

export interface TextStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// All mutations serialize through one durable write. A queued payload is immutable.
export class Outbox {
  private pending: Promise<unknown> = Promise.resolve();
  private syncing = false;
  private rows: Draft[] = [];
  private loaded = false;
  private loading: Promise<Draft[]> | null = null;
  private listeners = new Set<() => void>();
  private key: string;
  constructor(
    private storage: TextStorage,
    private origin: string,
    private uuid: () => string,
  ) {
    this.key = `secondbrain.m1.outbox.v1:${origin}`;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  list(): Draft[] {
    return copy(this.rows);
  }
  load(): Promise<Draft[]> {
    if (this.loaded) {
      this.emit();
      return Promise.resolve(this.list());
    }
    if (!this.loading)
      this.loading = this.read().finally(() => {
        this.loading = null;
      });
    return this.loading;
  }
  private async read(): Promise<Draft[]> {
    const value = await this.storage.getItem(this.key);
    const rows: unknown = value ? JSON.parse(value) : [];
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !row ||
          typeof row !== 'object' ||
          typeof row.id !== 'string' ||
          row.origin !== this.origin ||
          !['draft', 'queued'].includes(row.status) ||
          !row.input ||
          row.input.kind !== 'text' ||
          typeof row.input.body_text !== 'string' ||
          typeof row.input.title !== 'string' ||
          typeof row.input.captured_at !== 'string' ||
          typeof row.input.timezone !== 'string' ||
          row.input.consent_confirmed !== true ||
          ['people', 'projects', 'events'].some(
            (key) =>
              !Array.isArray(row.input[key]) ||
              row.input[key].some((name: unknown) => typeof name !== 'string'),
          ),
      )
    ) {
      throw new Error('本地草稿格式不兼容，未覆盖原存储；请保留应用数据并检查版本。');
    }
    this.rows = rows as Draft[];
    this.loaded = true;
    this.emit();
    return this.list();
  }
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  private mutate<T>(change: (rows: Draft[]) => T): Promise<T> {
    const run = this.pending.then(async () => {
      if (!this.loaded) throw new Error('草稿仍未加载，不能覆盖本地资料。');
      const next = copy(this.rows);
      const result = change(next);
      await this.storage.setItem(this.key, JSON.stringify(next));
      this.rows = next;
      this.emit();
      return result;
    });
    this.pending = run.catch(() => undefined);
    return run;
  }
  save(input: RecordInput, id?: string): Promise<Draft> {
    return this.mutate((rows) => {
      const current = id ? rows.find((row) => row.id === id) : undefined;
      if (id && !current) throw new Error('草稿不存在，请重新打开。');
      if (current?.status === 'queued')
        throw new Error('此草稿已批准同步，内容已锁定，避免重试时产生冲突。');
      const draft: Draft = {
        id: current?.id ?? this.uuid(),
        origin: this.origin,
        input: recordInput(input),
        status: 'draft',
      };
      if (current) rows.splice(rows.indexOf(current), 1, draft);
      else rows.push(draft);
      return copy(draft);
    });
  }
  enqueue(id: string): Promise<void> {
    return this.mutate((rows) => {
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error('草稿不存在。');
      row.status = 'queued';
      row.error = undefined;
    });
  }
  discard(id: string): Promise<void> {
    return this.mutate((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return;
      if (rows[index].status === 'queued')
        throw new Error('同步结果可能尚未确认，不能取消幂等重试或直接删除队列。');
      rows.splice(index, 1);
    });
  }
  async sync(send: (input: RecordInput, key: string) => Promise<SourceRecord>): Promise<string[]> {
    if (this.syncing) return [];
    this.syncing = true;
    const created: string[] = [];
    try {
      await this.pending;
      for (const row of this.list().filter((item) => item.status === 'queued')) {
        try {
          const record = await send(copy(row.input), row.id);
          await this.mutate((rows) => {
            const index = rows.findIndex((item) => item.id === row.id);
            if (index >= 0) rows.splice(index, 1);
          });
          created.push(record.id);
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'RECORD_DELETED'
          ) {
            // A server tombstone is definitive: remove the local plaintext too.
            await this.mutate((rows) => {
              const index = rows.findIndex((item) => item.id === row.id);
              if (index >= 0) rows.splice(index, 1);
            });
            throw error;
          }
          const message = error instanceof Error ? error.message : '同步失败，保留原标识重试。';
          await this.mutate((rows) => {
            const pending = rows.find((item) => item.id === row.id);
            if (pending) pending.error = message;
          });
          throw error;
        }
      }
      return created;
    } finally {
      this.syncing = false;
    }
  }
}
