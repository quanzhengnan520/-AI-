import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useReducer } from 'react';
import RecordsScreen from '../src/app/(tabs)/records';
import AskScreen from '../src/app/ask';
import RemindersScreen from '../src/app/reminders';
import { RecordSheet } from '../src/components/record-sheet';
import { createDemoState } from '../src/providers/mock';
import { DemoContext, demoReducer } from '../src/services/demo-state';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

function Wrapper({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(demoReducer, undefined, createDemoState);
  return <DemoContext.Provider value={{ state, dispatch }}>{children}</DemoContext.Provider>;
}

test('记录页持续显示 Mock 标识，搜索无结果时有恢复提示', async () => {
  await render(<RecordsScreen />, { wrapper: Wrapper });
  expect(screen.getByText(/Mock 演示/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('搜索记录'), '不存在的项目');
  expect(screen.getByText('暂时没有匹配的演示内容')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('搜索记录'), '');
  expect(screen.getByText('项目预算 · 最新沟通')).toBeTruthy();
});
test('模拟录音暂停停止计时，完成不声称保存了音频', async () => {
  jest.useFakeTimers();
  try {
    await render(<RecordSheet visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByText('确认并开始演示'));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('00:02')).toBeTruthy();
    await fireEvent.press(screen.getByText('暂停演示'));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('00:02')).toBeTruthy();
    await fireEvent.press(screen.getByText('继续演示'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('00:03')).toBeTruthy();
    await fireEvent.press(screen.getByText('完成演示'));
    expect(screen.getByText('演示结束 · 未生成音频文件')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});
test('问答能取消演示回答，并对无依据问题显示拒答', async () => {
  jest.useFakeTimers();
  try {
    await render(<AskScreen />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByLabelText('输入问题'), '合同已经签了吗？');
    await fireEvent.press(screen.getByText('查看演示回答'));
    await fireEvent.press(screen.getByText('取消回答'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('依据不足')).toBeNull();
    await fireEvent.press(screen.getByText('查看演示回答'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('依据不足')).toBeTruthy();
    expect(screen.getByText(/无法从现有资料确认/)).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});
test('提醒页演示确认后才出现完成操作，不申请系统通知', async () => {
  await render(<RemindersScreen />, { wrapper: Wrapper });
  expect(screen.getByText(/不调度系统通知/)).toBeTruthy();
  await fireEvent.press(screen.getByText('确认演示待办'));
  expect(screen.queryByText('候选待办 · 待你确认')).toBeNull();
  expect(screen.getAllByText('标记演示完成')).toHaveLength(2);
});
