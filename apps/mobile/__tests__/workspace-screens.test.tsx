import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import EditorScreen from '../src/app/workspace/editor';
import AskScreen from '../src/app/workspace/ask';
import MemoryScreen from '../src/app/workspace/memory/[id]';
import RecordScreen from '../src/app/workspace/record/[id]';
import { codePointExcerpt } from '../src/components/workspace-ui';
import { workspaceApi } from '../src/services/workspace-api';
import { useWorkspace } from '../src/services/workspace-state';
import { outbox } from '../src/services/workspace-storage';
import { syntheticInput, syntheticMemory, syntheticRecord } from './workspace-fixtures';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../src/services/workspace-api', () => ({
  workspaceApi: {
    record: jest.fn(),
    update: jest.fn(),
    extract: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
    memory: jest.fn(),
    review: jest.fn(),
  },
}));
jest.mock('../src/services/workspace-state', () => ({ useWorkspace: jest.fn() }));
jest.mock('../src/services/workspace-storage', () => ({
  outbox: { list: jest.fn(), save: jest.fn(), enqueue: jest.fn(), discard: jest.fn() },
}));

const mockedWorkspace = jest.mocked(useWorkspace);
const params = jest.mocked(useLocalSearchParams);
const api = jest.mocked(workspaceApi);
const box = jest.mocked(outbox);
const context = {
  ready: true,
  drafts: [],
  session: { device_id: 'synthetic-device', device_token: 'synthetic-token' },
  metadata: { llm_provider: 'mock' },
  busy: false,
  message: '',
  revision: 0,
  pair: jest.fn(),
  logout: jest.fn(),
  sync: jest.fn(async () => [] as string[]),
  refresh: jest.fn(),
};
beforeEach(() => {
  params.mockReturnValue({});
  mockedWorkspace.mockReturnValue(context);
  box.list.mockReturnValue([]);
  api.record.mockResolvedValue(syntheticRecord);
  api.memory.mockResolvedValue(syntheticMemory);
  context.session = { device_id: 'synthetic-device', device_token: 'synthetic-token' };
  box.save.mockImplementation(async (input) => ({
    id: 'synthetic-stable-draft',
    origin: 'http://fixture.local',
    input,
    status: 'draft',
  }));
});

test('组合后的中文正文与关联超出请求大小时不锁入发送队列', async () => {
  await render(<EditorScreen />);
  await fireEvent.changeText(screen.getByLabelText('文字标题'), '虚构长文字');
  await fireEvent.changeText(screen.getByLabelText('原始文字内容'), '字'.repeat(10000));
  const names = Array.from({ length: 20 }, (_, index) => '人'.repeat(97) + index).join('，');
  await fireEvent.changeText(screen.getByLabelText('人物（逗号分隔）'), names);
  await fireEvent.press(screen.getByText('保存并批准同步文字'));
  expect(screen.getByText(/文字和关联内容合计过长/)).toBeTruthy();
  expect(box.save).not.toHaveBeenCalled();
  expect(box.enqueue).not.toHaveBeenCalled();
  expect(screen.getByLabelText('原始文字内容').props.value).toHaveLength(10000);
});

test('多人物、项目和事件输入保留尾部分隔符，保存时再分割', async () => {
  await render(<EditorScreen />);
  await fireEvent.changeText(screen.getByLabelText('文字标题'), syntheticInput.title);
  await fireEvent.changeText(screen.getByLabelText('原始文字内容'), syntheticInput.body_text);
  await fireEvent.changeText(screen.getByLabelText('人物（逗号分隔）'), '王总，');
  expect(screen.getByLabelText('人物（逗号分隔）').props.value).toBe('王总，');
  await fireEvent.changeText(screen.getByLabelText('人物（逗号分隔）'), '王总，李总');
  await fireEvent.changeText(screen.getByLabelText('项目（逗号分隔）'), '虚构甲项目，虚构乙项目');
  await fireEvent.changeText(screen.getByLabelText('事件（逗号分隔）'), '预算沟通，虚构复核');
  await fireEvent.press(screen.getByText('保存本机草稿'));
  await waitFor(() => expect(box.save).toHaveBeenCalled());
  expect(box.save.mock.calls[0][0]).toMatchObject({
    people: ['王总', '李总'],
    projects: ['虚构甲项目', '虚构乙项目'],
    events: ['预算沟通', '虚构复核'],
  });
  expect(screen.getByText(/草稿已保存到本机/)).toBeTruthy();
});
test.each([401, 409])('编辑遭%s时保留输入和原预期版本，重新配对不覆盖输入', async (status) => {
  params.mockReturnValue({ id: syntheticRecord.id });
  api.update.mockRejectedValueOnce(new Error(`虚构HTTP ${status}：输入仍保留`));
  await render(<EditorScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText('原始文字内容').props.value).toBe(syntheticInput.body_text),
  );
  await fireEvent.changeText(screen.getByLabelText('原始文字内容'), '虚构编辑：预算尚未获批。');
  await fireEvent.press(screen.getByText('提交文字修改'));
  expect(screen.getByText(`虚构HTTP ${status}：输入仍保留`)).toBeTruthy();
  expect(screen.getByLabelText('原始文字内容').props.value).toBe('虚构编辑：预算尚未获批。');
  context.session = { device_id: 'synthetic-repaired', device_token: 'synthetic-new-token' };
  await screen.rerender(<EditorScreen />);
  expect(screen.getByLabelText('原始文字内容').props.value).toBe('虚构编辑：预算尚未获批。');
  expect(api.update.mock.calls[0][3]).toBe(1);
});
test('存储失败保留输入，不显示草稿已保存', async () => {
  box.save.mockRejectedValueOnce(new Error('虚构存储写入失败'));
  await render(<EditorScreen />);
  await fireEvent.changeText(screen.getByLabelText('文字标题'), syntheticInput.title);
  await fireEvent.changeText(screen.getByLabelText('原始文字内容'), syntheticInput.body_text);
  await fireEvent.press(screen.getByText('保存本机草稿'));
  expect(screen.getByText('虚构存储写入失败')).toBeTruthy();
  expect(screen.queryByText(/草稿已保存到本机/)).toBeNull();
  expect(screen.getByLabelText('原始文字内容').props.value).toBe(syntheticInput.body_text);
});
test('超过关联数量限制时在批准队列前保留输入并要求修正', async () => {
  await render(<EditorScreen />);
  await fireEvent.changeText(screen.getByLabelText('文字标题'), syntheticInput.title);
  await fireEvent.changeText(screen.getByLabelText('原始文字内容'), syntheticInput.body_text);
  const names = Array.from({ length: 21 }, (_, index) => `虚构${index}`).join('，');
  await fireEvent.changeText(screen.getByLabelText('人物（逗号分隔）'), names);
  await fireEvent.press(screen.getByText('保存并批准同步文字'));
  expect(screen.getByText(/每类关联最多20个名称/)).toBeTruthy();
  expect(box.enqueue).not.toHaveBeenCalled();
  expect(screen.getByLabelText('人物（逗号分隔）').props.value).toBe(names);
});
test('emoji在证据前时按Unicode码点高亮准确原话', async () => {
  const body = `😀${syntheticInput.body_text}`;
  expect(codePointExcerpt(body, 1, Array.from(body).length)).toBe(syntheticInput.body_text);
  params.mockReturnValue({
    id: syntheticRecord.id,
    version: '1',
    start: '1',
    end: String(Array.from(body).length),
  });
  api.record.mockResolvedValue({ ...syntheticRecord, body_text: body });
  await render(<RecordScreen />);
  await waitFor(() =>
    expect(screen.getByTestId('workspace-evidence-highlight').props.children).toBe(
      syntheticInput.body_text,
    ),
  );
  expect(api.record).toHaveBeenCalledWith('synthetic-token', syntheticRecord.id, 1);
});
test('默认抽取按按钮才请求Mock，删除需第二次明确确认', async () => {
  params.mockReturnValue({ id: syntheticRecord.id });
  api.extract.mockResolvedValue({ items: [syntheticMemory], provider: 'mock' });
  api.remove.mockResolvedValue({ deleted: true });
  await render(<RecordScreen />);
  await screen.findByText(syntheticInput.title);
  expect(api.extract).not.toHaveBeenCalled();
  expect(api.remove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('抽取这条记录的候选记忆'));
  expect(api.extract).toHaveBeenCalledWith('synthetic-token', syntheticRecord.id, 1, false);
  await fireEvent.press(screen.getByText('查看删除确认'));
  expect(api.remove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('确认删除原文与派生记忆'));
  expect(api.remove).toHaveBeenCalledWith('synthetic-token', syntheticRecord.id, 1);
});
test('修改候选只保存correct动作，必须另点确认', async () => {
  params.mockReturnValue({ id: syntheticMemory.id });
  api.review.mockResolvedValue({ ...syntheticMemory, status: 'needs_review', version: 2 });
  await render(<MemoryScreen />);
  await screen.findByText(/王总 · 项目预算预计/);
  await fireEvent.changeText(
    screen.getByLabelText('修改候选表述'),
    '虚构修正：预算预计200万元，未获批。',
  );
  await fireEvent.press(screen.getByText('保存修改并待复核'));
  expect(api.review).toHaveBeenCalledTimes(1);
  expect(api.review.mock.calls[0][2]).toBe('correct');
  expect(screen.getByText(/仍待核实；请核对来源/)).toBeTruthy();
});
test('无依据回答使用真实接口拒答，且展示服务端引用', async () => {
  api.query.mockResolvedValue({
    answer: '无法确认200万元曾获批准。',
    certainty: 'insufficient_evidence',
    limitations: ['预计不等于批准。'],
    citations: [
      {
        record_id: syntheticRecord.id,
        record_version: 1,
        start_char: 0,
        end_char: 18,
        quote: syntheticInput.body_text,
        captured_at: syntheticInput.captured_at,
        status: 'candidate',
      },
    ],
  });
  await render(<AskScreen />);
  await fireEvent.changeText(screen.getByLabelText('向记忆系统提问'), '200万元预算获得批准了吗？');
  await fireEvent.press(screen.getByText('检索并引用来源'));
  expect(screen.getByText('无法确认200万元曾获批准。')).toBeTruthy();
  expect(screen.getByText('预计不等于批准。')).toBeTruthy();
  expect(screen.getByText('打开真实来源 1')).toBeTruthy();
  expect(api.query.mock.calls[0][1]).toBe('200万元预算获得批准了吗？');
});
test('取消问答保留问题，之后到达的结果不会覆盖取消状态', async () => {
  let complete!: (value: {
    answer: string;
    certainty: string;
    citations: [];
    limitations: [];
  }) => void;
  api.query.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await render(<AskScreen />);
  await fireEvent.changeText(screen.getByLabelText('向记忆系统提问'), '虚构项目是否已批准？');
  await fireEvent.press(screen.getByText('检索并引用来源'));
  await fireEvent.press(screen.getByText('取消本次检索'));
  complete({ answer: '不应出现的旧响应', certainty: 'unknown', citations: [], limitations: [] });
  await waitFor(() => expect(screen.getByText('已取消检索，问题仍保留。')).toBeTruthy());
  expect(screen.queryByText('不应出现的旧响应')).toBeNull();
  expect(screen.getByLabelText('向记忆系统提问').props.value).toBe('虚构项目是否已批准？');
});
