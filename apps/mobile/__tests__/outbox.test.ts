import { Outbox, type TextStorage } from '../src/services/outbox';
import { syntheticInput, syntheticRecord } from './workspace-fixtures';

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  } satisfies TextStorage & { values: Map<string, string> };
}
const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('离线草稿重启恢复，未批准内容不会发送', async () => {
  const disk = storage();
  const first = new Outbox(disk, 'http://fixture.local', () => key);
  await first.load();
  await first.save(syntheticInput);
  const restarted = new Outbox(disk, 'http://fixture.local', () => 'unused');
  await restarted.load();
  expect(restarted.list()[0].input.body_text).toBe(syntheticInput.body_text);
  const send = jest.fn().mockResolvedValue(syntheticRecord);
  expect(await restarted.sync(send)).toEqual([]);
  expect(send).not.toHaveBeenCalled();
});
test('丢失成功响应后重启重试复用UUID和不可变载荷，服务端只需保存一次', async () => {
  const disk = storage();
  const first = new Outbox(disk, 'http://fixture.local', () => key);
  await first.load();
  const draft = await first.save(syntheticInput);
  await first.enqueue(draft.id);
  const server = new Map<string, string>();
  const send = jest.fn(async (input, id: string) => {
    server.set(id, JSON.stringify(input));
    if (send.mock.calls.length === 1) throw new Error('模拟响应丢失');
    return syntheticRecord;
  });
  await expect(first.sync(send)).rejects.toThrow('模拟响应丢失');
  const restarted = new Outbox(disk, 'http://fixture.local', () => 'must-not-change');
  await restarted.load();
  expect(await restarted.sync(send)).toEqual([syntheticRecord.id]);
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
  expect(server.size).toBe(1);
  expect(restarted.list()).toEqual([]);
});
test('队列持久化失败时不声称批准成功，内存和存储保持未批准草稿', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  const draft = await box.save(syntheticInput);
  disk.setItem.mockRejectedValueOnce(new Error('模拟磁盘满'));
  await expect(box.enqueue(draft.id)).rejects.toThrow('模拟磁盘满');
  expect(box.list()[0].status).toBe('draft');
  const restarted = new Outbox(disk, 'http://fixture.local', () => key);
  await restarted.load();
  expect(restarted.list()[0].status).toBe('draft');
});
test('新草稿持久化失败不发布假成功，之后可以重试', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  disk.setItem.mockRejectedValueOnce(new Error('模拟写入拒绝'));
  await expect(box.save(syntheticInput)).rejects.toThrow('模拟写入拒绝');
  expect(box.list()).toEqual([]);
  await box.save(syntheticInput);
  expect(box.list()).toHaveLength(1);
});
test('批准后的草稿不能改写或丢弃，避免已接受请求重试时冲突', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  const draft = await box.save(syntheticInput);
  await box.enqueue(draft.id);
  await expect(box.save({ ...syntheticInput, body_text: '虚构改写' }, draft.id)).rejects.toThrow(
    '锁定',
  );
  await expect(box.discard(draft.id)).rejects.toThrow('不能取消');
  expect(box.list()[0].input.body_text).toBe(syntheticInput.body_text);
});
test.each([401, 409])('%s失败保留全部原文、稳定UUID和批准状态', async (status) => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  await box.save(syntheticInput);
  await box.enqueue(key);
  await expect(
    box.sync(async () => {
      throw new Error(`虚构HTTP ${status}`);
    }),
  ).rejects.toThrow(String(status));
  expect(box.list()[0]).toMatchObject({ id: key, status: 'queued', input: syntheticInput });
  const restarted = new Outbox(disk, 'http://fixture.local', () => 'unused');
  await restarted.load();
  expect(restarted.list()[0].error).toContain(String(status));
});
test('并发重试不会同时发送同一草稿', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  await box.save(syntheticInput);
  await box.enqueue(key);
  let finish!: (record: typeof syntheticRecord) => void;
  const send = jest.fn(
    () =>
      new Promise<typeof syntheticRecord>((resolve) => {
        finish = resolve;
      }),
  );
  const first = box.sync(send);
  await Promise.resolve();
  await Promise.resolve();
  expect(await box.sync(send)).toEqual([]);
  finish(syntheticRecord);
  await first;
  expect(send).toHaveBeenCalledTimes(1);
});
test('草稿严格绑定服务地址，换后端不会自动加载旧队列', async () => {
  const disk = storage();
  const original = new Outbox(disk, 'http://fixture-a.local', () => key);
  await original.load();
  await original.save(syntheticInput);
  await original.enqueue(key);
  const another = new Outbox(disk, 'http://fixture-b.local', () => 'another');
  expect(await another.load()).toEqual([]);
  const send = jest.fn();
  await another.sync(send);
  expect(send).not.toHaveBeenCalled();
});
test('损坏存储拒绝覆盖，未载入时不能创建新草稿', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  disk.getItem.mockResolvedValueOnce('{broken');
  await expect(box.load()).rejects.toThrow();
  await expect(box.save(syntheticInput)).rejects.toThrow('不能覆盖');
  expect(disk.setItem).not.toHaveBeenCalled();
});
test('工作区重新挂载不会在同步中重新读取旧磁盘快照', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  await box.save(syntheticInput);
  await box.load();
  expect(disk.getItem).toHaveBeenCalledTimes(1);
  expect(box.list()).toHaveLength(1);
});
test('明确服务端墓碑后清除本机同步正文，不重建已删除记录', async () => {
  const disk = storage();
  const box = new Outbox(disk, 'http://fixture.local', () => key);
  await box.load();
  await box.save(syntheticInput);
  await box.enqueue(key);
  const error = Object.assign(new Error('虚构服务端已删除'), { code: 'RECORD_DELETED' });
  await expect(
    box.sync(async () => {
      throw error;
    }),
  ).rejects.toThrow('虚构服务端已删除');
  expect(box.list()).toEqual([]);
  const restarted = new Outbox(disk, 'http://fixture.local', () => 'unused');
  expect(await restarted.load()).toEqual([]);
  expect([...disk.values.values()].join('')).not.toContain(syntheticInput.body_text);
});
