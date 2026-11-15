interface Envelope {
  data: Record<string, unknown>;
  request_id: string;
}

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
export const apiBaseUrl = baseUrl.replace(/\/$/, '');

async function getMetadata(
  path: '/health' | '/api/v1/meta',
  signal: AbortSignal,
): Promise<Envelope> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('后端未就绪，请检查启动状态和数据库迁移。');
  const json: unknown = await response.json();
  if (
    !json ||
    typeof json !== 'object' ||
    !('data' in json) ||
    !('request_id' in json) ||
    typeof json.request_id !== 'string' ||
    typeof json.data !== 'object' ||
    json.data === null
  ) {
    throw new Error('API 响应格式不兼容，请检查 API 版本。');
  }
  return json as Envelope;
}

// 仅由设置页的用户点击触发。没有自动连接、重试上传或供应商凭据。
export async function checkLocalConnection(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const [health, meta] = await Promise.all([
      getMetadata('/health', controller.signal),
      getMetadata('/api/v1/meta', controller.signal),
    ]);
    if (health.data.status !== 'ok') throw new Error('后端未就绪，请检查数据库迁移。');
    if (meta.data.mode !== 'mock') throw new Error('M0 仅连接 Mock 后端，请检查服务配置。');
    return '后端已连接 · Mock；页面仍使用本机会话演示数据。';
  } catch (error) {
    if (error instanceof Error && /后端|API|M0/.test(error.message)) throw error;
    throw new Error('连接失败。请检查 API 地址、同一网络和后端启动状态后重试。');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
