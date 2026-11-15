import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Badge, Button, Card, Page, Section, styles } from '../../components/ui';
import { Field, Notice, reviewLabels, WorkspaceNav } from '../../components/workspace-ui';
import { workspaceApi } from '../../services/workspace-api';
import { useWorkspace } from '../../services/workspace-state';
import type { QueryAnswer } from '../../types/workspace';

export default function AskScreen() {
  const workspace = useWorkspace();
  const [question, setQuestion] = useState('');
  const [entities, setEntities] = useState('');
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  async function ask() {
    if (!workspace.session || !question.trim()) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setMessage('正在检索带来源的记忆…');
    setAnswer(null);
    try {
      const result = await workspaceApi.query(
        workspace.session.device_token,
        question,
        entities
          .split(/[,，]/)
          .map((value) => value.trim())
          .filter(Boolean),
        controller.signal,
      );
      if (request.current === controller && !controller.signal.aborted) {
        setAnswer(result);
        setMessage('');
      }
    } catch (failure) {
      if (request.current === controller && !controller.signal.aborted)
        setMessage(failure instanceof Error ? failure.message : '检索失败，问题仍保留。');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  function cancel() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setMessage('已取消检索，问题仍保留。');
  }
  return (
    <Page title="有来源的问答" subtitle="证据不足时明确无法确认" demo={false}>
      <WorkspaceNav />
      <Field
        label="向记忆系统提问"
        value={question}
        onChangeText={setQuestion}
        multiline
        editable={!busy}
        maxLength={500}
      />
      <Field
        label="限定人物或项目（可选，逗号分隔）"
        value={entities}
        onChangeText={setEntities}
        editable={!busy}
      />
      <Button
        title="检索并引用来源"
        disabled={!workspace.session || busy || !question.trim()}
        onPress={() => {
          void ask();
        }}
      />
      {busy && <Button secondary title="取消本次检索" onPress={cancel} />}
      <Notice>
        {!workspace.session ? '请先配对本地服务。不会使用演示答案替代检索结果。' : message}
      </Notice>
      {answer && (
        <>
          <Card tint>
            <Badge>
              {answer.certainty === 'insufficient_evidence'
                ? '证据不足 · 无法确认'
                : '有原文依据 · 结论有限'}
            </Badge>
            <Text selectable style={styles.body}>
              {answer.answer}
            </Text>
          </Card>
          {answer.limitations.map((limitation, index) => (
            <Notice key={index}>{limitation}</Notice>
          ))}
          <Section title={`来源引用 · ${answer.citations.length}`} />
          {answer.citations.map((citation, index) => (
            <Card key={`${citation.record_id}-${citation.start_char}-${index}`}>
              <Text selectable style={styles.body}>
                “{citation.quote}”
              </Text>
              <Text style={styles.small}>
                {citation.captured_at} · {reviewLabels[citation.status] ?? citation.status} · v
                {citation.record_version}
              </Text>
              <Button
                secondary
                title={`打开真实来源 ${index + 1}`}
                onPress={() =>
                  router.push({
                    pathname: '/workspace/record/[id]',
                    params: {
                      id: citation.record_id,
                      version: String(citation.record_version),
                      start: String(citation.start_char),
                      end: String(citation.end_char),
                    },
                  })
                }
              />
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}
