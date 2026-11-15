import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Badge, Button, Card, Empty, Page, Section, styles } from '../../components/ui';
import { formatDate, useDemo } from '../../services/demo-state';
import { reviewLabels } from '../../types/domain';

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useDemo();
  const fact = state.memories.find((item) => item.id === id);
  if (!fact)
    return (
      <Page title="记忆不存在">
        <Empty text="未找到这条演示记忆，请返回记忆列表。" />
      </Page>
    );
  const record = state.records.find((item) => item.id === fact.evidence.recordId);
  return (
    <Page title="有依据的记忆" subtitle="陈述、证据与确认状态分别展示">
      <Card>
        <Badge tone={fact.category === 'hypothesis' ? 'amber' : 'blue'}>
          {fact.category === 'hypothesis' ? 'AI 推测 · 演示' : '当事人陈述 · 演示'}
        </Badge>
        <Text style={[styles.title, { fontSize: 21, lineHeight: 33 }]}>{fact.title}</Text>
        <Text style={styles.muted}>
          {reviewLabels[fact.status]} · v{fact.version}
        </Text>
        <Text style={styles.small}>
          有效时间：{formatDate(fact.eventTime, state.timezone)}
          {'\n'}记录时间：{formatDate(fact.recordedAt, state.timezone)}
        </Text>
      </Card>
      <Section title="判断依据" />
      <Card>
        {record ? (
          <>
            <Text style={styles.title}>{record.title}</Text>
            <Text style={styles.body}>
              “{record.body.slice(fact.evidence.startChar, fact.evidence.endChar)}”
            </Text>
            <Button
              secondary
              title="打开原始记录并定位引用"
              onPress={() =>
                router.push({
                  pathname: '/record/[id]',
                  params: {
                    id: record.id,
                    start: fact.evidence.startChar.toString(),
                    end: fact.evidence.endChar.toString(),
                  },
                })
              }
            />
          </>
        ) : (
          <Text style={styles.muted}>原始证据不可用，无法重新核验。</Text>
        )}
      </Card>
      <Card tint>
        <Text style={styles.title}>你的判断，始终优先</Text>
        <Text style={styles.body}>
          {fact.category === 'hypothesis'
            ? '这是一项推测，建议核实后再作为依据。'
            : '你可以确认“曾有这项表述”，不应把它视为正式审批通过。'}
        </Text>
        <Text style={styles.small}>以下操作只改变本次演示状态，刷新后恢复；不写入真实记忆库。</Text>
        <Button
          title="确认这条演示记忆"
          disabled={fact.status === 'verified_by_user'}
          onPress={() => dispatch({ type: 'review', id: fact.id, status: 'verified_by_user' })}
        />
        <Button
          secondary
          title="驳回这条演示记忆"
          disabled={fact.status === 'rejected'}
          onPress={() => dispatch({ type: 'review', id: fact.id, status: 'rejected' })}
        />
      </Card>
    </Page>
  );
}
