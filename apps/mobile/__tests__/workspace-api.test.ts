import { workspaceApi } from '../src/services/workspace-api';
import { syntheticInput, syntheticMemory, syntheticRecord } from './workspace-fixtures';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = originalFetch;
});
beforeEach(() => {
  fetchMock.mockReset();
});
function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => ({
      request_id: 'synthetic-request',
      ...(status < 400 ? { data } : { error: { code: 'SYNTHETIC_FAILURE' } }),
    }),
  });
}
test('新建发送配对令牌和稳定幂等键，仅包含白名单输入', async () => {
  respond(syntheticRecord);
  await workspaceApi.create('synthetic-device-token', syntheticRecord, 'synthetic-stable-key');
  const options = fetchMock.mock.calls[0][1];
  expect(options.headers.Authorization).toBe('Bearer synthetic-device-token');
  expect(options.headers['Idempotency-Key']).toBe('synthetic-stable-key');
  expect(JSON.parse(options.body)).toEqual(syntheticInput);
});
test('修改仅发PATCH允许字段和预期版本，不发kind/consent/id或历史元数据', async () => {
  respond(syntheticRecord);
  await workspaceApi.update('synthetic-token', syntheticRecord.id, syntheticRecord, 1);
  const options = fetchMock.mock.calls[0][1];
  const sent = JSON.parse(options.body);
  expect(options.method).toBe('PATCH');
  expect(sent).toMatchObject({ title: syntheticInput.title, expected_version: 1 });
  for (const field of ['id', 'version', 'kind', 'consent_confirmed', 'status', 'created_at'])
    expect(sent).not.toHaveProperty(field);
});
test.each([401, 409])('%s返回可操作错误，不把失败伪装成成功', async (status) => {
  respond(null, status);
  await expect(
    workspaceApi.create('synthetic-token', syntheticInput, 'same-key'),
  ).rejects.toMatchObject({
    status,
    message: expect.stringContaining(status === 401 ? '重新配对' : '输入仍保留'),
  });
});
test('抽取需显式点击调用，默认界面传false，修改记忆不自动确认', async () => {
  respond({ items: [syntheticMemory], provider: 'mock' });
  await workspaceApi.extract('synthetic-token', syntheticRecord.id, 1, false);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    expected_version: 1,
    allow_live_ai: false,
  });
  respond(syntheticMemory);
  await workspaceApi.review('synthetic-token', syntheticMemory, 'correct', '虚构修正内容');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    expected_version: 1,
    review_action: 'correct',
    corrected_object_text: '虚构修正内容',
  });
});
test('来源打开指定原文版本，删除必须包含确认和版本', async () => {
  respond(syntheticRecord);
  await workspaceApi.record('synthetic-token', syntheticRecord.id, 1);
  expect(fetchMock.mock.calls[0][0]).toContain('?version=1');
  respond({ deleted: true });
  await workspaceApi.remove('synthetic-token', syntheticRecord.id, 1);
  expect(fetchMock.mock.calls[1][0]).toContain('?expected_version=1&confirm=true');
});
test('无request_id包络被拒绝，不伪造服务端结果', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => syntheticRecord });
  await expect(workspaceApi.record('synthetic-token', syntheticRecord.id)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
test('原文删除后的失效引用明确无法核实，不提示抽取失败后原文仍在', async () => {
  respond(null, 404);
  await expect(workspaceApi.record('synthetic-token', syntheticRecord.id, 1)).rejects.toMatchObject(
    { status: 404, message: '未找到资料或原文已删除，无法核实来源。' },
  );
});
