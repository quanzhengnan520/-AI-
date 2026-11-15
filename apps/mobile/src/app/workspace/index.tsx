import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Badge, Button, Card, Empty, Page, Section, styles } from '../../components/ui';
import { Field, Notice, useResource, WorkspaceNav } from '../../components/workspace-ui';
import { workspaceApi } from '../../services/workspace-api';
import { useWorkspace } from '../../services/workspace-state';
import type { SourceRecord } from '../../types/workspace';

export default function WorkspaceScreen() {
  const workspace = useWorkspace();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState('');
  const load = useCallback(
    () =>
      workspace.session
        ? workspaceApi.records(workspace.session.device_token, query, cursor)
        : Promise.resolve(null),
    [workspace.session, query, cursor],
  );
  const { data, error } = useResource(load, workspace.revision);
  return (
    <Page title="文字工作区" subtitle="原始文字 → 候选记忆 → 可打开的依据" demo={false}>
      <WorkspaceNav />
      <Card tint>
        <Text style={styles.body}>
          文字保存到你配对的本地服务；记忆抽取默认为 Mock 规则演示。SQLite
          与本机草稿尚未生产级加密，请仅使用虚构测试资料。
        </Text>
        <Text style={styles.small}>
          {workspace.session ? '本机已配对 · 保存与抽取分别触发' : '尚未配对 · 可以先保存离线草稿'}
        </Text>
      </Card>
      <Button
        title="新建文字记录"
        disabled={!workspace.ready}
        onPress={() => router.push('/workspace/editor')}
      />
      <Notice>{workspace.message || (!workspace.ready ? '正在读取本机草稿…' : '')}</Notice>
      <Section title={`本机草稿 · ${workspace.drafts.length}`} />
      {workspace.drafts.map((draft) => (
        <Pressable
          key={draft.id}
          accessibilityRole="button"
          accessibilityLabel={`打开草稿：${draft.input.title || '未命名'}`}
          onPress={() =>
            router.push({ pathname: '/workspace/editor', params: { draft: draft.id } })
          }
        >
          <Card>
            <Badge tone={draft.status === 'queued' ? 'amber' : 'gray'}>
              {draft.status === 'queued' ? '已批准 · 待同步（内容锁定）' : '仅本机 · 未批准同步'}
            </Badge>
            <Text style={styles.title}>{draft.input.title || '未命名草稿'}</Text>
            {draft.error && <Text style={styles.muted}>{draft.error}</Text>}
          </Card>
        </Pressable>
      ))}
      {workspace.drafts.some((draft) => draft.status === 'queued') && (
        <Button
          title="重试已批准的文字同步"
          disabled={workspace.busy}
          onPress={() => {
            void workspace.sync();
          }}
        />
      )}
      <Section title="服务端时间线" />
      <Field label="搜索文字、人物、项目或事件" value={search} onChangeText={setSearch} />
      <Button
        secondary
        title="检索文字记录"
        disabled={!workspace.session}
        onPress={() => {
          setCursor('');
          setQuery(search);
          workspace.refresh();
        }}
      />
      <Notice>{error}</Notice>
      {!workspace.session && <Empty text="配对后可读取服务端时间线。本机离线草稿不会自动发送。" />}
      {data?.items.map((record: SourceRecord) => (
        <Pressable
          key={record.id}
          accessibilityRole="button"
          accessibilityLabel={`打开本机记录：${record.title}`}
          onPress={() =>
            router.push({ pathname: '/workspace/record/[id]', params: { id: record.id } })
          }
        >
          <Card>
            <Badge>服务端已保存 · v{record.version}</Badge>
            <Text style={styles.title}>{record.title}</Text>
            <Text style={styles.muted}>
              {new Date(record.captured_at).toLocaleString('zh-CN', { timeZone: record.timezone })}
            </Text>
            <Text style={styles.small}>
              {[...record.people, ...record.projects, ...record.events].join(' · ')}
            </Text>
          </Card>
        </Pressable>
      ))}
      {data && !data.items.length && (
        <Empty text="没有匹配的文字记录。可以新建记录或更换关键词。" />
      )}
      {data?.next_cursor && (
        <Button
          secondary
          title="下一页文字记录"
          onPress={() => setCursor(data.next_cursor ?? '')}
        />
      )}
    </Page>
  );
}
