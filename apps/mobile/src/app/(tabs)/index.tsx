import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RecordSheet } from '../../components/record-sheet';
import { Badge, Button, Card, colors, Page, Section, styles } from '../../components/ui';
import { formatDate, useDemo } from '../../services/demo-state';

export default function TodayScreen() {
  const { state } = useDemo();
  const [recording, setRecording] = useState(false);
  return (
    <>
      <Page
        title="今天，记得更清楚"
        subtitle={formatDate(new Date().toISOString(), state.timezone, false)}
        action={
          <View style={home.avatar}>
            <Text style={{ color: colors.blue, fontWeight: '700' }}>忆</Text>
          </View>
        }
      >
        <Text style={styles.muted}>把琐碎留在这里，把注意力还给当下。</Text>
        <View style={home.hero}>
          <View style={styles.row}>
            <Text style={home.heroEyebrow}>你的个人第二大脑</Text>
            <Text style={home.heroEyebrow}>✦</Text>
          </View>
          <Text style={home.heroTitle}>{'重要的事，\n不必只靠记性。'}</Text>
          <Text style={home.heroSubtitle}>记录 → 记忆 → 依据 → 行动</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="问一问，打开历史问答"
            onPress={() => router.push('/ask')}
            style={home.ask}
          >
            <Text style={{ color: '#DCE7FF', fontSize: 14 }}>问问过去发生过什么…</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22 }}>↗</Text>
          </Pressable>
        </View>
        <Button title="文字工作区 · M1" onPress={() => router.push('/workspace')} />
        <Button title="＋ 开始记录 · 演示" onPress={() => setRecording(true)} />
        <Text style={[styles.small, { textAlign: 'center' }]}>
          当前使用合成数据，不采集麦克风 · 无云端模型调用
        </Text>
        <View style={home.stats}>
          <View>
            <Text style={home.statValue}>{state.records.length.toString().padStart(2, '0')}</Text>
            <Text style={styles.small}>演示记录</Text>
          </View>
          <View style={home.statLine} />
          <View>
            <Text style={home.statValue}>{state.memories.length.toString().padStart(2, '0')}</Text>
            <Text style={styles.small}>演示记忆</Text>
          </View>
          <View style={home.statLine} />
          <View>
            <Text style={home.statValue}>
              {state.tasks
                .filter((t) => t.status !== 'done')
                .length.toString()
                .padStart(2, '0')}
            </Text>
            <Text style={styles.small}>演示待办</Text>
          </View>
        </View>
        <Section title="值得再确认" link="查看记忆" onPress={() => router.push('/memories')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看预算变化记忆"
          onPress={() =>
            router.push({ pathname: '/memory/[id]', params: { id: state.memories[0].id } })
          }
        >
          <Card>
            <Badge tone="amber">变化提示 · 预设演示</Badge>
            <Text style={styles.title}>预算变了，原因还不确定</Text>
            <Text style={styles.body}>
              10月预计 200 万 → 11月考虑 150 万。两次口头表述有所变化，需要进一步核实。
            </Text>
            <View style={styles.row}>
              <Text style={styles.small}>青岚项目 · 王总（虚构）</Text>
              <Text style={{ color: colors.blue, fontSize: 12 }}>查看依据 →</Text>
            </View>
          </Card>
        </Pressable>
        <Section title="接下来要做" link="全部提醒" onPress={() => router.push('/reminders')} />
        <Card>
          {state.tasks.slice(0, 2).map((task, index) => (
            <View key={task.id} style={{ gap: 9 }}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <Text style={[styles.body, { flex: 1 }]}>{task.title}</Text>
                <Badge tone={task.status === 'proposed' ? 'amber' : 'green'}>
                  {task.status === 'proposed'
                    ? '待确认'
                    : task.status === 'done'
                      ? '已完成'
                      : '已确认'}
                </Badge>
              </View>
              <Text style={styles.small}>{formatDate(task.dueAt, state.timezone)} · 演示事项</Text>
            </View>
          ))}
        </Card>
        <Section title="近期记录" link="全部记录" onPress={() => router.push('/records')} />
        {state.records.slice(0, 1).map((record) => (
          <Pressable
            key={record.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })}
          >
            <Card>
              <Text style={styles.title}>{record.title}</Text>
              <Text style={styles.muted}>
                {formatDate(record.capturedAt, state.timezone)} · {record.tag}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {record.body}
              </Text>
            </Card>
          </Pressable>
        ))}
      </Page>
      <RecordSheet visible={recording} onClose={() => setRecording(false)} />
    </>
  );
}
const home = StyleSheet.create({
  avatar: {
    backgroundColor: '#E8EFFF',
    height: 42,
    width: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { backgroundColor: '#245DE0', borderRadius: 24, padding: 24, gap: 16, marginTop: 4 },
  heroEyebrow: { color: '#DCE7FF', fontSize: 12 },
  heroTitle: {
    fontSize: 30,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 44,
    letterSpacing: 1,
  },
  heroSubtitle: { color: '#C8D9FF', fontSize: 12, letterSpacing: 1 },
  ask: {
    borderRadius: 13,
    backgroundColor: '#FFFFFF20',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
  },
  statValue: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  statLine: { height: 30, width: 1, backgroundColor: colors.line },
});
