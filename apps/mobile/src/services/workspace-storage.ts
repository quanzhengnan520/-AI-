import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { DeviceSession } from '../types/workspace';
import { apiBaseUrl } from './connection';
import { Outbox } from './outbox';

const tokenKey = 'secondbrain.m1.device';
export const outbox = new Outbox(AsyncStorage, apiBaseUrl, Crypto.randomUUID);
export async function readSession(): Promise<DeviceSession | null> {
  const raw =
    Platform.OS === 'web'
      ? globalThis.sessionStorage?.getItem(tokenKey)
      : await SecureStore.getItemAsync(tokenKey);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('origin' in value) ||
    value.origin !== apiBaseUrl ||
    !('device_id' in value) ||
    !('device_token' in value) ||
    typeof value.device_id !== 'string' ||
    typeof value.device_token !== 'string'
  )
    return null;
  return { device_id: value.device_id, device_token: value.device_token };
}
export async function writeSession(session: DeviceSession | null) {
  if (Platform.OS === 'web') {
    if (!globalThis.sessionStorage) throw new Error('浏览器会话存储不可用，未保存设备凭据。');
    if (session)
      globalThis.sessionStorage.setItem(
        tokenKey,
        JSON.stringify({ ...session, origin: apiBaseUrl }),
      );
    else globalThis.sessionStorage.removeItem(tokenKey);
  } else if (session)
    await SecureStore.setItemAsync(tokenKey, JSON.stringify({ ...session, origin: apiBaseUrl }));
  else await SecureStore.deleteItemAsync(tokenKey);
}
