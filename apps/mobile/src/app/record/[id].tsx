import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Card, colors, Empty, Page, Section, styles } from '../../components/ui';
import { formatDate, useDemo } from '../../services/demo-state';

export default function RecordDetailScreen() {
  const { id, start, end } = useLocalSearchParams<{ id: string; start?: string; end?: string }>();
  const { state } = useDemo();
  const record = state.records.find((item) => item.id === id);
  if (!record)
    return (
      <Page title="记录不存在">
        <Empty text="未找到这条演示记录，请返回记录列表。" />
      </Page>
    );
  const startChar = Number(start);
  const endChar = Number(end);
  const highlighted =
    Number.isInteger(startChar) &&
    Number.isInteger(endChar) &&
    startChar >= 0 &&
    endChar <= record.body.length &&
    endChar > startChar;
  return (
    <Page title="一段记录" subtitle={formatDate(record.capturedAt, state.timezone)}>
      <Card>
        <Badge>演示文字记录 · v{record.version}</Badge>
        <Text style={[styles.title, { fontSize: 22, lineHeight: 32 }]}>{record.title}</Text>
        <Text style={styles.muted}>
          {record.tag} · {state.timezone}
        </Text>
      </Card>
      <Section title="原始文字 · 合成样本" />
      <Card>
        {highlighted && (
          <Badge tone="green">
            已定位引用 · 字符 {startChar}–{endChar}
          </Badge>
        )}
        <Text selectable style={styles.body}>
          {highlighted ? (
            <>
              {record.body.slice(0, startChar)}
              <Text
                testID="evidence-highlight"
                style={{ backgroundColor: '#FFF0B8', color: colors.ink }}
              >
                {record.body.slice(startChar, endChar)}
              </Text>
              {record.body.slice(endChar)}
            </>
          ) : (
            record.body
          )}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.small}>这是一条预置文字样本；没有可播放的音频文件。</Text>
      </Card>
      <Section title="资料与来源" />
      <Card>
        <Text style={styles.body}>原始资料保留策略：{state.retentionDays} 天（演示设置）</Text>
        <Text style={styles.muted}>M0 不运行清理任务；真实保存、修订和删除将在后续阶段实现。</Text>
        <Text selectable style={styles.small}>
          来源 ID：{record.id}
        </Text>
      </Card>
    </Page>
  );
}
