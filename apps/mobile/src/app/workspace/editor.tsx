import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Page, styles } from '../../components/ui';
import { Field, Notice, WorkspaceNav } from '../../components/workspace-ui';
import { workspaceApi } from '../../services/workspace-api';
import { outbox } from '../../services/workspace-storage';
import { useWorkspace } from '../../services/workspace-state';
import { recordInput, type RecordInput } from '../../types/workspace';

const blank = (): RecordInput => ({
  kind: 'text',
  title: '',
  body_text: '',
  captured_at: new Date().toISOString(),
  timezone: 'Asia/Shanghai',
  consent_confirmed: true,
  people: [],
  projects: [],
  events: [],
});
const splitNames = (value: string) => [
  ...new Set(
    value
      .split(/[,，\n]/)
      .map((part) => part.trim())
      .filter(Boolean),
  ),
];
export default function EditorScreen() {
  const params = useLocalSearchParams<{ id?: string; draft?: string }>();
  const workspace = useWorkspace();
  const [input, setInput] = useState<RecordInput>(blank);
  const [names, setNames] = useState({ people: '', projects: '', events: '' });
  const [draftId, setDraftId] = useState(params.draft);
  const [version, setVersion] = useState<number | null>(null);
  const [message, setMessage] = useState('文字不会自动保存；请先保存草稿，再批准同步。');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!params.id && !params.draft);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const initialized = useRef('');
  const queued = workspace.drafts.find((draft) => draft.id === draftId)?.status === 'queued';
  const editable = loaded && !busy && !queued;
  useEffect(() => {
    let active = true;
    const key = params.id ? `record:${params.id}` : params.draft ? `draft:${params.draft}` : 'new';
    if (!workspace.ready || initialized.current === key) return;
    const apply = (value: RecordInput, expectedVersion?: number) => {
      if (!active) return;
      initialized.current = key;
      setInput(recordInput(value));
      setNames({
        people: value.people.join('，'),
        projects: value.projects.join('，'),
        events: value.events.join('，'),
      });
      if (expectedVersion !== undefined) setVersion(expectedVersion);
      setLoaded(true);
    };
    if (params.draft) {
      const draft = outbox.list().find((row) => row.id === params.draft);
      Promise.resolve().then(() => {
        if (draft) apply(draft.input);
        else if (active) setMessage('草稿已同步或不存在，请返回时间线查看。');
      });
    } else if (params.id && workspace.session) {
      workspaceApi
        .record(workspace.session.device_token, params.id)
        .then((record) => apply(record, record.version))
        .catch((error) => {
          if (active) setMessage(error instanceof Error ? error.message : '记录读取失败。');
        });
    }
    return () => {
      active = false;
    };
  }, [params.draft, params.id, workspace.ready, workspace.session]);
  function field<K extends keyof RecordInput>(key: K, value: RecordInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }
  function payload() {
    if (!input.title.trim() || !input.body_text.trim()) throw new Error('请填写标题和文字内容。');
    if (
      !Number.isFinite(Date.parse(input.captured_at)) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(input.captured_at)
    )
      throw new Error('时间需带时区，例如 2026-11-15T10:00:00+08:00。');
    try {
      new Intl.DateTimeFormat('zh-CN', { timeZone: input.timezone });
    } catch {
      throw new Error('请输入有效时区，例如 Asia/Shanghai。');
    }
    const associations = {
      people: splitNames(names.people),
      projects: splitNames(names.projects),
      events: splitNames(names.events),
    };
    for (const values of Object.values(associations)) {
      if (values.length > 20 || values.some((name) => Array.from(name).length > 100))
        throw new Error('每类关联最多20个名称，每个名称最多100字；输入仍保留，请缩短后保存。');
    }
    const value = {
      ...recordInput(input),
      ...associations,
    };
    const bytes = Array.from(JSON.stringify(value)).reduce((total, character) => {
      const point = character.codePointAt(0) ?? 0;
      return total + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
    }, 0);
    if (bytes > 32768) throw new Error('文字和关联内容合计过长，请缩短或拆分后同步；输入仍保留。');
    return value;
  }
  async function save(queue: boolean) {
    setBusy(true);
    try {
      const value = payload();
      if (params.id) {
        if (!workspace.session || version === null)
          throw new Error('请重新配对并读取记录。输入仍保留。');
        const record = await workspaceApi.update(
          workspace.session.device_token,
          params.id,
          value,
          version,
        );
        workspace.refresh();
        router.replace({ pathname: '/workspace/record/[id]', params: { id: record.id } });
      } else {
        const draft = await outbox.save(value, draftId);
        setDraftId(draft.id);
        if (queue) {
          await outbox.enqueue(draft.id);
          setMessage('草稿已持久保存并批准同步；内容锁定，重试会复用同一标识。');
          const ids = await workspace.sync();
          if (ids.length && !outbox.list().some((row) => row.id === draft.id))
            router.replace('/workspace');
        } else setMessage('草稿已保存到本机；尚未批准发送，刷新或重启后可恢复。');
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '保存失败，未声称草稿已保存。请保留当前输入并重试。',
      );
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    if (!draftId) return;
    setBusy(true);
    try {
      await outbox.discard(draftId);
      router.replace('/workspace');
    } catch {
      setMessage('草稿未删除，请保留当前资料后重试。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={params.id ? '编辑文字记录' : '新建文字记录'}
      subtitle={
        params.id ? '版本冲突时保留输入，请核对后再提交' : '先保存本机草稿，由你决定何时同步'
      }
      demo={false}
    >
      <WorkspaceNav />
      <Notice>{message}</Notice>
      <Notice>{workspace.message}</Notice>
      <Field
        label="文字标题"
        value={input.title}
        onChangeText={(value) => field('title', value)}
        editable={editable}
        maxLength={200}
      />
      <Field
        label="原始文字内容"
        value={input.body_text}
        onChangeText={(value) => field('body_text', value)}
        multiline
        editable={editable}
        maxLength={10000}
      />
      <Field
        label="记录发生时间（ISO，带时区）"
        value={input.captured_at}
        onChangeText={(value) => field('captured_at', value)}
        editable={editable}
        maxLength={40}
      />
      <Field
        label="显示时区"
        value={input.timezone}
        onChangeText={(value) => field('timezone', value)}
        editable={editable}
        maxLength={60}
      />
      {(['people', 'projects', 'events'] as const).map((key) => (
        <Field
          key={key}
          label={`${{ people: '人物', projects: '项目', events: '事件' }[key]}（逗号分隔）`}
          value={names[key]}
          onChangeText={(value) => setNames((current) => ({ ...current, [key]: value }))}
          editable={editable}
        />
      ))}
      <Card>
        <Text style={styles.small}>
          仅输入虚构资料。保存原文不代表认可其中陈述；候选记忆需另行抽取与审核。
        </Text>
      </Card>
      {queued ? (
        <>
          <Notice>已批准的草稿不能改写；即使响应丢失，重试也使用原载荷，避免重复记录。</Notice>
          <Button
            title="重试这批已批准同步"
            disabled={workspace.busy}
            onPress={() => {
              void workspace.sync();
            }}
          />
        </>
      ) : (
        <>
          <Button
            title={params.id ? '提交文字修改' : '保存本机草稿'}
            disabled={!editable}
            onPress={() => {
              void save(false);
            }}
          />
          {!params.id && (
            <Button
              secondary
              title="保存并批准同步文字"
              disabled={!editable}
              onPress={() => {
                void save(true);
              }}
            />
          )}
          {draftId && !params.id && (
            <Button
              secondary
              title="删除未批准草稿"
              disabled={busy}
              onPress={() => setDiscardConfirm(true)}
            />
          )}
          {discardConfirm && (
            <>
              <Notice>此操作将清除这条本机草稿。</Notice>
              <Button
                title="确认删除本机草稿"
                disabled={busy}
                onPress={() => {
                  void discard();
                }}
              />
              <Button secondary title="保留草稿" onPress={() => setDiscardConfirm(false)} />
            </>
          )}
        </>
      )}
    </Page>
  );
}
