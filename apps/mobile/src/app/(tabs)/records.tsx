import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { Badge, Card, Empty, Page, styles } from '../../components/ui';
import { formatDate, useDemo } from '../../services/demo-state';

export default function RecordsScreen() {
  const { state } = useDemo();
  const [search, setSearch] = useState('');
  const records = state.records.filter((record) =>
    `${record.title}${record.body}${record.tag}`.includes(search.trim()),
  );
  return (
    <Page title="记录" subtitle="每一段记忆，都有来处">
      <TextInput
        accessibilityLabel="搜索记录"
        value={search}
        onChangeText={setSearch}
        placeholder="搜索标题、内容或项目"
        placeholderTextColor="#9BA6B7"
        style={styles.input}
      />
      <Text style={styles.small}>{records.length} 条演示记录 · 未同步任何真实资料</Text>
      {records.map((record) => (
        <Pressable
          key={record.id}
          accessibilityRole="button"
          accessibilityLabel={`打开记录：${record.title}`}
          onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })}
        >
          <Card>
            <Badge tone={record.status === 'needs_review' ? 'amber' : 'green'}>
              {record.status === 'needs_review' ? '待确认 · 演示' : '演示记录'}
            </Badge>
            <Text style={styles.title}>{record.title}</Text>
            <Text style={styles.body} numberOfLines={2}>
              {record.body}
            </Text>
            <Text style={styles.small}>
              {formatDate(record.capturedAt, state.timezone)} · {record.tag}
            </Text>
          </Card>
        </Pressable>
      ))}
      {records.length === 0 && <Empty />}
    </Page>
  );
}
