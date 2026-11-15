import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Badge, Button, Card, Page, styles } from '../../../components/ui';
import {
  Field,
  Notice,
  reviewLabels,
  useResource,
  WorkspaceNav,
} from '../../../components/workspace-ui';
import { workspaceApi } from '../../../services/workspace-api';
import { useWorkspace } from '../../../services/workspace-state';

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace();
  const [reload, setReload] = useState(0);
  const load = useCallback(
    () =>
      workspace.session
        ? workspaceApi.memory(workspace.session.device_token, id)
        : Promise.resolve(null),
    [workspace.session, id],
  );
  const { data: fact, error } = useResource(load, reload);
  const [correction, setCorrection] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function review(action: 'verify' | 'reject' | 'correct') {
    if (!workspace.session || !fact) return;
    if (action === 'correct' && !correction.trim()) {
      setMessage('请先填写修改后的表述。');
      return;
    }
    setBusy(true);
    try {
      await workspaceApi.review(workspace.session.device_token, fact, action, correction);
      setMessage(
        action === 'correct'
          ? '修改已保存，仍待核实；请核对来源后另行确认。'
          : action === 'verify'
            ? '已人工确认此表述，原文证据与时间仍保留。'
            : '已驳回，不作为高可信度依据。',
      );
      setReload((value) => value + 1);
      workspace.refresh();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : '审核未完成，修改内容仍保留。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="审核候选记忆" subtitle="原话、时间和确认状态必须一起核对" demo={false}>
      <WorkspaceNav />
      <Notice>{error || message}</Notice>
      {fact && (
        <>
          <Card>
            <Badge>
              {reviewLabels[fact.status] ?? fact.status} · v{fact.version}
            </Badge>
            <Text style={styles.title}>
              {fact.subject} · {fact.object_text}
            </Text>
            <Text style={styles.small}>
              关系：{fact.predicate} · 表述类型：{fact.modality} · 确信度：{fact.certainty}
            </Text>
            <Text style={styles.small}>发生时间：{fact.event_time || '来源未明确指定'}</Text>
            <Text style={styles.small}>记录时间：{fact.recorded_at}</Text>
            <Text style={styles.body}>原文证据：“{fact.evidence_anchor.quote}”</Text>
            <Text style={styles.small}>
              来源记录 {fact.source_record_id} · v{fact.source_record_version}
            </Text>
          </Card>
          <Button
            title="打开来源并高亮原话"
            onPress={() =>
              router.push({
                pathname: '/workspace/record/[id]',
                params: {
                  id: fact.source_record_id,
                  version: String(fact.source_record_version),
                  start: String(fact.evidence_anchor.start_char),
                  end: String(fact.evidence_anchor.end_char),
                },
              })
            }
          />
          <Notice>
            确认的是这段有证据的表述。“预计200万元”不表示预算获批；新的150万元信息也不会删除旧原文。
          </Notice>
          <Field
            label="修改候选表述"
            value={correction}
            onChangeText={setCorrection}
            multiline
            editable={!busy}
            maxLength={2000}
          />
          <Button
            title="保存修改并待复核"
            disabled={busy || fact.status === 'superseded'}
            onPress={() => {
              void review('correct');
            }}
          />
          <Button
            title="确认这条候选记忆"
            disabled={busy || fact.status === 'superseded'}
            onPress={() => {
              void review('verify');
            }}
          />
          <Button
            secondary
            title="驳回这条候选记忆"
            disabled={busy || fact.status === 'superseded'}
            onPress={() => {
              void review('reject');
            }}
          />
          <Button
            secondary
            title="读取最新候选版本（保留修改输入）"
            disabled={busy}
            onPress={() => setReload((value) => value + 1)}
          />
        </>
      )}
    </Page>
  );
}
