import { apiBaseUrl } from './connection';
import { Platform } from 'react-native';
import type {
  ApiMetadata,
  DeviceSession,
  MemoryFact,
  PageResult,
  QueryAnswer,
  RecordInput,
  SourceRecord,
} from '../types/workspace';
import { recordInput } from '../types/workspace';

export class WorkspaceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function workspaceRequest<T>(
  path: string,
  token = '',
  options: { method?: string; body?: unknown; key?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel);
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 12000);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.key ? { 'Idempotency-Key': options.key } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('request_id' in result))
      throw new WorkspaceError(0, 'INVALID_RESPONSE', '服务器响应格式不兼容。');
    if (!response.ok) {
      const code =
        'error' in result &&
        result.error &&
        typeof result.error === 'object' &&
        'code' in result.error
          ? String(result.error.code)
          : 'HTTP_ERROR';
      throw new WorkspaceError(
        response.status,
        code,
        code === 'RECORD_DELETED'
          ? '此记录已在服务端删除，不会重建原文。'
          : response.status === 401
            ? '设备令牌失效，请重新配对；本地草稿仍保留。'
            : response.status === 404
              ? '未找到资料或原文已删除，无法核实来源。'
              : response.status === 409
                ? '版本或幂等冲突：你的输入仍保留，请重新读取最新内容后处理。'
                : response.status === 422
                  ? '输入格式不合法，请检查文字长度、时间和关联名称。'
                  : '操作未完成，请稍后重试。原始记录不会因抽取失败而丢失。',
      );
    }
    if (!('data' in result)) throw new WorkspaceError(0, 'INVALID_RESPONSE', '服务器缺少数据。');
    return result.data as T;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError(
      0,
      'NETWORK_ERROR',
      '连接中断或超时，尚未确认同步成功；草稿保留，可用相同标识重试。',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export const workspaceApi = {
  pair: (code: string, name: string) =>
    workspaceRequest<DeviceSession>('/api/v1/auth/devices/pair', '', {
      method: 'POST',
      body: { pairing_code: code, name, platform: Platform.OS },
    }),
  meta: () => workspaceRequest<ApiMetadata>('/api/v1/meta'),
  records: (token: string, q = '', cursor = '') =>
    workspaceRequest<PageResult<SourceRecord>>(
      `/api/v1/records?limit=20&q=${encodeURIComponent(q)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      token,
    ),
  record: (token: string, id: string, version?: number) =>
    workspaceRequest<SourceRecord>(
      `/api/v1/records/${encodeURIComponent(id)}${version ? `?version=${version}` : ''}`,
      token,
    ),
  create: (token: string, input: RecordInput, key: string) =>
    workspaceRequest<SourceRecord>('/api/v1/records', token, {
      method: 'POST',
      body: recordInput(input),
      key,
    }),
  update: (token: string, id: string, input: RecordInput, version: number) =>
    workspaceRequest<SourceRecord>(`/api/v1/records/${encodeURIComponent(id)}`, token, {
      method: 'PATCH',
      body: {
        title: input.title,
        body_text: input.body_text,
        captured_at: input.captured_at,
        timezone: input.timezone,
        people: input.people,
        projects: input.projects,
        events: input.events,
        expected_version: version,
      },
    }),
  remove: (token: string, id: string, version: number) =>
    workspaceRequest(
      `/api/v1/records/${encodeURIComponent(id)}?expected_version=${version}&confirm=true`,
      token,
      { method: 'DELETE' },
    ),
  extract: (token: string, id: string, version: number, allowLive: boolean) =>
    workspaceRequest<{ items: MemoryFact[]; provider: string }>(
      `/api/v1/records/${encodeURIComponent(id)}/extract`,
      token,
      { method: 'POST', body: { expected_version: version, allow_live_ai: allowLive } },
    ),
  memories: (token: string, status = '', q = '', cursor = '') =>
    workspaceRequest<PageResult<MemoryFact>>(
      `/api/v1/memories?limit=20${status ? `&status=${encodeURIComponent(status)}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      token,
    ),
  memory: (token: string, id: string) =>
    workspaceRequest<MemoryFact>(`/api/v1/memories/${encodeURIComponent(id)}`, token),
  review: (
    token: string,
    fact: MemoryFact,
    action: 'verify' | 'reject' | 'correct',
    correction: string,
  ) =>
    workspaceRequest<MemoryFact>(`/api/v1/memories/${encodeURIComponent(fact.id)}`, token, {
      method: 'PATCH',
      body: {
        expected_version: fact.version,
        review_action: action,
        ...(action === 'correct' ? { corrected_object_text: correction } : {}),
      },
    }),
  query: (token: string, question: string, entities: string[], signal: AbortSignal) =>
    workspaceRequest<QueryAnswer>('/api/v1/queries', token, {
      method: 'POST',
      body: { question, filters: { entity_names: entities }, include_uncertainty: true },
      signal,
    }),
};
