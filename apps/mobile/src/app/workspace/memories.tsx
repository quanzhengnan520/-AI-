import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, Empty, Page, styles } from '../../components/ui';
import {
  Field,
  Notice,
  reviewLabels,
  useResource,
  WorkspaceNav,
} from '../../components/workspace-ui';
import { workspaceApi } from '../../services/workspace-api';
import { useWorkspace } from '../../services/workspace-state';

export default function MemoriesScreen() {
  const workspace = useWorkspace();
  const [status, setStatus] = useState('candidate');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState('');
  const load = useCallback(
    () =>
      workspace.session
        ? workspaceApi.memories(workspace.session.device_token, status, query, cursor)
        : Promise.resolve(null),
    [workspace.session, status, query, cursor],
  );
  const { data, error } = useResource(load, workspace.revision);
  return (
    <Page title="候选长期记忆" subtitle="先核对来源，再决定是否确认" demo={false}>
      <WorkspaceNav />
      <Notice>
        候选和待复核内容不进入高可信度长期记忆。人工确认只确认当前表述，不能把“预计预算”变成“预算已获批准”。
      </Notice>
      <View style={[styles.row, { justifyContent: 'flex-start' }]}>
        {[
          ['candidate', '待核实'],
          ['needs_review', '待复核'],
          ['verified_by_user', '人工确认'],
          ['rejected', '已驳回'],
          ['', '全部状态'],
        ].map(([value, label]) => (
          <Button
            key={label}
            secondary
            title={status === value ? `✓ ${label}` : label}
            onPress={() => {
              setStatus(value);
              setCursor('');
            }}
          />
        ))}
      </View>
      <Field label="检索候选记忆" value={search} onChangeText={setSearch} />
      <Button
        secondary
        title="搜索候选记忆"
        disabled={!workspace.session}
        onPress={() => {
          setQuery(search);
          setCursor('');
          workspace.refresh();
        }}
      />
      <Notice>{error}</Notice>
      {!workspace.session && <Empty text="请先配对本地后端。" />}
      {data?.items.map((fact) => (
        <Pressable
          key={fact.id}
          accessibilityRole="button"
          accessibilityLabel={`打开候选：${fact.object_text}`}
          onPress={() =>
            router.push({ pathname: '/workspace/memory/[id]', params: { id: fact.id } })
          }
        >
          <Card>
            <Badge tone={fact.status === 'verified_by_user' ? 'green' : 'amber'}>
              {reviewLabels[fact.status] ?? fact.status}
            </Badge>
            <Text style={styles.title}>
              {fact.subject} · {fact.object_text}
            </Text>
            <Text style={styles.small}>
              {fact.modality} · {fact.event_time || fact.recorded_at}
            </Text>
            <Text style={styles.body}>原话：“{fact.evidence_anchor.quote}”</Text>
            <Text style={styles.small}>来源版本 v{fact.source_record_version}</Text>
          </Card>
        </Pressable>
      ))}
      {data && !data.items.length && (
        <Empty text="没有匹配的记忆。请先在文字详情触发抽取，或选择全部状态查看。" />
      )}
      {data?.next_cursor && (
        <Button
          secondary
          title="下一页候选记忆"
          onPress={() => setCursor(data.next_cursor ?? '')}
        />
      )}
    </Page>
  );
}
