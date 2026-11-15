import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiBaseUrl } from '../src/services/connection';
import { readSession, writeSession } from '../src/services/workspace-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const session = { device_id: 'synthetic-device', device_token: 'synthetic-device-token' };
afterEach(() => {
  jest.restoreAllMocks();
});
test('原生设备令牌进入SecureStore，不写入普通草稿AsyncStorage', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await writeSession(session);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'secondbrain.m1.device',
    JSON.stringify({ ...session, origin: apiBaseUrl }),
  );
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValueOnce(JSON.stringify({ ...session, origin: apiBaseUrl }));
  expect(await readSession()).toEqual(session);
});
test('不同服务地址或损坏凭据不会被当作有效配对，未同步草稿不受影响', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValueOnce(JSON.stringify({ ...session, origin: 'http://other-fixture.local' }))
    .mockResolvedValueOnce('{broken');
  expect(await readSession()).toBeNull();
  expect(await readSession()).toBeNull();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
test('退出原生配对仅清除凭据，不清空离线草稿', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await writeSession(null);
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secondbrain.m1.device');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
test('Web令牌限于sessionStorage，不永久写入localStorage', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const values = new Map<string, string>();
  const tab = {
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    removeItem: jest.fn((key: string) => {
      values.delete(key);
    }),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: tab });
  try {
    await writeSession(session);
    expect(await readSession()).toEqual(session);
    expect(tab.setItem).toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    await writeSession(null);
    expect(await readSession()).toBeNull();
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
