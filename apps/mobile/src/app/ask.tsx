import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, colors, Page, Section, styles } from '../components/ui';
import { answerDemoQuestion, sampleQuestions } from '../providers/mock';
import { useDemo } from '../services/demo-state';
import type { DemoAnswer } from '../types/domain';

export default function AskScreen() {
  const { state } = useDemo();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<DemoAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function ask() {
    if (!question.trim() || busy) return;
    setBusy(true);
    setAnswer(null);
    timer.current = setTimeout(() => {
      setAnswer(answerDemoQuestion(question, state));
      setBusy(false);
      timer.current = null;
    }, 450);
  }
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBusy(false);
  }
  return (
    <Page title="问问你的记忆" subtitle="答案之外，也看看依据">
      <Card tint>
        <Text style={[styles.title, { color: colors.blue }]}>✦ 从已有记录出发</Text>
        <Text style={styles.body}>
          这里演示如何展示答案、来源和不确定性；没有调用真实 AI 模型。
        </Text>
      </Card>
      <TextInput
        multiline
        accessibilityLabel="输入问题"
        placeholder="关于过去，你想知道什么？"
        placeholderTextColor="#9BA6B7"
        maxLength={500}
        value={question}
        onChangeText={setQuestion}
        editable={!busy}
        style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
      />
      <Button
        title={busy ? '正在准备演示回答…' : '查看演示回答'}
        disabled={busy || !question.trim()}
        onPress={ask}
      />
      {busy && <Button secondary title="取消回答" onPress={cancel} />}
      <Text style={styles.small}>预设问答，不是实时检索或模型推理。请勿输入真实隐私资料。</Text>
      <Section title="试着这样问" />
      {sampleQuestions.map((sample) => (
        <Pressable
          accessibilityRole="button"
          key={sample}
          onPress={() => {
            if (!busy) {
              setQuestion(sample);
              setAnswer(null);
            }
          }}
          style={{ padding: 15, borderRadius: 12, backgroundColor: '#FFFFFF' }}
        >
          <Text style={{ color: colors.blue, fontSize: 14 }}>{sample} ↗</Text>
        </Pressable>
      ))}
      {answer && (
        <>
          <Section title="预设演示回答" />
          <Card>
            <Badge tone={answer.certainty === 'insufficient_evidence' ? 'amber' : 'blue'}>
              {answer.certainty === 'insufficient_evidence' ? '依据不足' : '有依据 · 仍有局限'}
            </Badge>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {answer.answer}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.muted}>{answer.limitations}</Text>
          </Card>
          {answer.citations.map((citation, index) => {
            const record = state.records.find((item) => item.id === citation.recordId);
            return record ? (
              <Pressable
                key={record.id}
                accessibilityRole="button"
                accessibilityLabel={`打开问答来源${index + 1}`}
                onPress={() =>
                  router.push({
                    pathname: '/record/[id]',
                    params: {
                      id: record.id,
                      start: citation.startChar.toString(),
                      end: citation.endChar.toString(),
                    },
                  })
                }
              >
                <Card>
                  <Text style={styles.title}>
                    [{index + 1}] {record.title}
                  </Text>
                  <Text style={styles.muted}>演示文字来源 · 点击定位引用 →</Text>
                </Card>
              </Pressable>
            ) : null;
          })}
        </>
      )}
    </Page>
  );
}
