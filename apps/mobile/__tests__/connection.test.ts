import { checkLocalConnection } from '../src/services/connection';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('主动连接只读 health/meta，不携带记录正文或鉴权秘密', async () => {
  const fetchMock = jest.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: url.endsWith('/health') ? { status: 'ok' } : { mode: 'mock' },
          request_id: 'test-request',
        }),
    }),
  );
  global.fetch = fetchMock;
  expect(await checkLocalConnection()).toContain('后端已连接');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/health',
    '/api/v1/meta',
  ]);
  for (const [, options] of fetchMock.mock.calls) {
    expect(options.body).toBeUndefined();
    expect(options.headers).toEqual({ Accept: 'application/json' });
  }
});
test('网络失败给出可恢复提示', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network'));
  await expect(checkLocalConnection()).rejects.toThrow('连接失败');
});
test('不把格式不兼容响应当作连接成功', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) });
  await expect(checkLocalConnection()).rejects.toThrow('API 响应格式不兼容');
});
test('拒绝非 Mock 服务元数据', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: url.endsWith('/health') ? { status: 'ok' } : { mode: 'live' },
          request_id: 'test-request',
        }),
    }),
  );
  await expect(checkLocalConnection()).rejects.toThrow('M0 仅连接 Mock 后端');
});
