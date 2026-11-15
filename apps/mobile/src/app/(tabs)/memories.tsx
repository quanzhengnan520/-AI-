import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, colors, Empty, Page, styles } from '../../components/ui';
import { useDemo } from '../../services/demo-state';
import { reviewLabels } from '../../types/domain';
export default function MemoriesScreen() {
  const { state } = useDemo();
  const [filter, setFilter] = useState('全部');
  const memories = state.memories.filter(
    (fact) =>
      filter === '全部' ||
      (filter === '待核实' ? fact.status === 'candidate' : fact.subject === filter),
  );
  return (
    <Page title="记忆" subtitle="事实与推测，分开记住">
      <View style={[styles.row, { justifyContent: 'flex-start' }]}>
        {['全部', '王总', '青岚项目', '待核实'].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === label }}
            onPress={() => setFilter(label)}
            style={{
              borderRadius: 20,
              paddingVertical: 11,
              paddingHorizontal: 16,
              backgroundColor: filter === label ? colors.blue : '#FFFFFF',
            }}
          >
            <Text style={{ color: filter === label ? '#FFFFFF' : colors.muted, fontSize: 13 }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.small}>确认只代表确认说过这句话，不等于审批结果已获证实。</Text>
      {memories.map((fact) => (
        <Pressable
          key={fact.id}
          accessibilityRole="button"
          accessibilityLabel={`打开记忆：${fact.title}`}
          onPress={() => router.push({ pathname: '/memory/[id]', params: { id: fact.id } })}
        >
          <Card>
            <View style={styles.row}>
              <Badge tone={fact.category === 'hypothesis' ? 'amber' : 'blue'}>
                {fact.category === 'hypothesis' ? 'AI 推测 · 演示' : '当事人陈述 · 演示'}
              </Badge>
              <Text style={styles.small}>v{fact.version}</Text>
            </View>
            <Text style={styles.title}>{fact.title}</Text>
            <View style={styles.row}>
              <Text style={styles.small}>
                {fact.subject} · {reviewLabels[fact.status]}
              </Text>
              <Text style={{ color: colors.blue, fontSize: 12 }}>查看来源 →</Text>
            </View>
          </Card>
        </Pressable>
      ))}
      {!memories.length && <Empty />}
    </Page>
  );
}
