import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Badge, Button, Card, Page, Section, styles } from '../../../components/ui';
import {
  codePointExcerpt,
  Notice,
  useResource,
  WorkspaceNav,
} from '../../../components/workspace-ui';
import { workspaceApi } from '../../../services/workspace-api';
import { useWorkspace } from '../../../services/workspace-state';

export default function RecordScreen() {
  const { id, version, start, end } = useLocalSearchParams<{
    id: string;
    version?: string;
    start?: string;
    end?: string;
  }>();
  const workspace = useWorkspace();
  const historyVersion = version && /^\d+$/.test(version) ? Number(version) : undefined;
  const load = useCallback(
    () =>
      workspace.session
        ? workspaceApi.record(workspace.session.device_token, id, historyVersion)
        : Promise.resolve(null),
    [workspace.session, id, historyVersion],
  );
  const { data: record, error } = useResource(load, workspace.revision);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [allowLive, setAllowLive] = useState(false);
  const live = workspace.metadata.llm_provider === 'openai_compatible';
  const startChar = Number(start);
  const endChar = Number(end);
  const highlighted =
    record &&
    start !== undefined &&
    end !== undefined &&
    Number.isInteger(startChar) &&
    Number.isInteger(endChar) &&
    startChar >= 0 &&
    endChar > startChar &&
    endChar <= Array.from(record.body_text).length;
  async function extract() {
    if (!record || !workspace.session) return;
    setBusy(true);
    try {
      const result = await workspaceApi.extract(
        workspace.session.device_token,
        record.id,
        record.version,
        live && allowLive,
      );
      setMessage(
        `已生成 ${result.items.length} 条候选记忆（${result.provider}）；仍需人工审核，不会自动成为高可信度事实。`,
      );
      workspace.refresh();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : '抽取失败，原始记录仍保留。');
    } finally {
      setBusy(false);
      setAllowLive(false);
    }
  }
  async function remove() {
    if (!record || !workspace.session) return;
    setBusy(true);
    try {
      await workspaceApi.remove(workspace.session.device_token, record.id, record.version);
      workspace.refresh();
      router.replace('/workspace');
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : '删除未完成。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="文字记录详情" subtitle="打开原文和时间，核对每一项引用" demo={false}>
      <WorkspaceNav />
      <Notice>{error || message}</Notice>
      {!workspace.session && <Notice>请先配对设备，再读取来源记录。</Notice>}
      {record && (
        <>
          <Card>
            <Badge>
              {historyVersion ? '引用对应历史版本' : '服务端已保存'} · v{record.version}
            </Badge>
            <Text style={styles.title}>{record.title}</Text>
            <Text style={styles.small}>
              发生时间：{record.captured_at} · {record.timezone}
            </Text>
            <Text style={styles.small}>保存时间：{record.created_at}</Text>
            <Text style={styles.small}>人物：{record.people.join('、') || '未关联'}</Text>
            <Text style={styles.small}>项目：{record.projects.join('、') || '未关联'}</Text>
            <Text style={styles.small}>事件：{record.events.join('、') || '未关联'}</Text>
          </Card>
          <Section title="原始文字" />
          <Card>
            {highlighted ? (
              <Text selectable style={styles.body}>
                {codePointExcerpt(record.body_text, 0, startChar)}
                <Text
                  testID="workspace-evidence-highlight"
                  style={{ backgroundColor: '#FEF08A', color: '#713F12' }}
                >
                  {codePointExcerpt(record.body_text, startChar, endChar)}
                </Text>
                {codePointExcerpt(record.body_text, endChar, Array.from(record.body_text).length)}
              </Text>
            ) : (
              <Text selectable style={styles.body}>
                {record.body_text}
              </Text>
            )}
          </Card>
          {historyVersion ? (
            <>
              <Notice>引用保留生成候选时的原文版本；旧版记忆不自动代表当前事实。</Notice>
              <Button
                title="打开当前版本记录"
                onPress={() => router.push({ pathname: '/workspace/record/[id]', params: { id } })}
              />
            </>
          ) : (
            <>
              <Button
                secondary
                title="编辑这条文字记录"
                disabled={busy}
                onPress={() => router.push({ pathname: '/workspace/editor', params: { id } })}
              />
              <Card>
                <Text style={styles.body}>
                  {live
                    ? '服务端配置了可替换模型。抽取将把本条文字发送到服务端配置的模型服务；请先确认部署者和服务地址。'
                    : '默认 Mock 规则抽取。仅调用你配对的本地后端，不调用外部模型。'}
                </Text>
                {live && (
                  <Text style={styles.small}>
                    目标模型服务：{workspace.metadata.llm_host || '未提供，请先核对服务端配置'}
                  </Text>
                )}
                {live && (
                  <View style={styles.row}>
                    <Text style={styles.small}>同意本次发送文字至模型</Text>
                    <Switch
                      accessibilityLabel="同意本次发送文字至模型"
                      value={allowLive}
                      onValueChange={setAllowLive}
                      disabled={!workspace.metadata.live_ai_enabled || busy}
                    />
                  </View>
                )}
                <Text style={styles.small}>
                  候选需附原文证据与确认状态。未经确认的推测不能作为高可信度记忆。
                </Text>
              </Card>
              <Button
                title="抽取这条记录的候选记忆"
                disabled={busy || (live && (!allowLive || !workspace.metadata.live_ai_enabled))}
                onPress={() => {
                  void extract();
                }}
              />
              <Button
                secondary
                title="查看候选记忆"
                onPress={() => router.push('/workspace/memories')}
              />
              <Button
                secondary
                title="查看删除确认"
                disabled={busy}
                onPress={() => setConfirm(true)}
              />
              {confirm && (
                <>
                  <Notice>
                    确认后将删除这条原文、历史版本和派生记忆，无法恢复。其他时间的独立记录会保留。
                  </Notice>
                  <Button
                    title="确认删除原文与派生记忆"
                    disabled={busy}
                    onPress={() => {
                      void remove();
                    }}
                  />
                  <Button secondary title="保留原始记录" onPress={() => setConfirm(false)} />
                </>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}
