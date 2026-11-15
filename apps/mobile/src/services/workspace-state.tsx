import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { ApiMetadata, DeviceSession, Draft } from '../types/workspace';
import { workspaceApi } from './workspace-api';
import { outbox, readSession, writeSession } from './workspace-storage';

interface WorkspaceState {
  ready: boolean;
  drafts: Draft[];
  session: DeviceSession | null;
  metadata: ApiMetadata;
  busy: boolean;
  message: string;
  revision: number;
  pair(code: string, name: string): Promise<void>;
  logout(): Promise<void>;
  sync(): Promise<string[]>;
  refresh(): void;
}
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [metadata, setMetadata] = useState<ApiMetadata>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const sessionRef = useRef<DeviceSession | null>(null);
  const syncRef = useRef(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    const unsubscribe = outbox.subscribe(() => {
      if (active) setDrafts(outbox.list());
    });
    outbox
      .load()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setMessage('本机草稿无法读取，未覆盖现有资料。请检查存储空间与权限。');
      });
    readSession()
      .then((device) => {
        if (active) {
          sessionRef.current = device;
          setSession(device);
        }
      })
      .catch(() => {
        if (active) setMessage('设备凭据无法读取，请重新配对；本机草稿仍可使用。');
      });
    // Only opened workspaces inspect the configured local backend, never M0.
    workspaceApi
      .meta()
      .then((value) => {
        if (active) setMetadata(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const sync = useCallback(async () => {
    const device = sessionRef.current;
    if (!device) {
      setMessage('请先配对本地服务；离线草稿仍保留。');
      return [];
    }
    if (syncRef.current) return [];
    syncRef.current = true;
    setBusy(true);
    setMessage('正在同步已批准的草稿…');
    try {
      const ids = await outbox.sync((input, key) => {
        if (sessionRef.current !== device) throw new Error('配对已更改，待同步草稿仍保留。');
        return workspaceApi.create(device.device_token, input, key);
      });
      setMessage(
        ids.length
          ? `已同步 ${ids.length} 条文字记录；候选记忆请从记录详情手动抽取。`
          : '没有待同步内容。',
      );
      if (ids.length) refresh();
      return ids;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '同步未完成，草稿仍保留。');
      // Earlier items in a batch may already have succeeded.
      refresh();
      return [];
    } finally {
      syncRef.current = false;
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    if (!ready || !session) return;
    // Only immutable items explicitly queued by the user are retried.
    const retry = () => {
      if (outbox.list().some((draft) => draft.status === 'queued')) void sync();
    };
    retry();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    if (Platform.OS === 'web') globalThis.addEventListener?.('online', retry);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') globalThis.removeEventListener?.('online', retry);
    };
  }, [ready, session, sync]);
  async function pair(code: string, name: string) {
    const device = await workspaceApi.pair(code, name);
    await writeSession(device);
    sessionRef.current = device;
    setSession(device);
    setMessage('本机设备已配对。');
    refresh();
  }
  async function logout() {
    await writeSession(null);
    sessionRef.current = null;
    setSession(null);
    setMessage('已清除此设备的本机凭据，未同步草稿仍保留。');
  }
  return (
    <WorkspaceContext.Provider
      value={{
        ready,
        drafts,
        session,
        metadata,
        busy,
        message,
        revision,
        pair,
        logout,
        sync,
        refresh,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider required');
  return value;
}
