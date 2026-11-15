import { router } from 'expo-router';
import { Text } from 'react-native';
import { Badge, Button, Card, Page, styles } from '../components/ui';
import { formatDate, useDemo } from '../services/demo-state';
export default function RemindersScreen() {
  const { state, dispatch } = useDemo();
  return (
    <Page title="接下来要做" subtitle="先由你确认，再成为行动">
      <Card tint>
        <Text style={styles.body}>
          演示事项仅在本次会话改变状态，不调度系统通知。真实提醒将在后续阶段接入。
        </Text>
        <Text style={styles.small}>锁屏隐私示例：你有一条待确认事项 · 静默时段 22:00–08:00</Text>
      </Card>
      {state.tasks.map((task) => (
        <Card key={task.id}>
          <Badge tone={task.status === 'proposed' ? 'amber' : 'green'}>
            {task.status === 'proposed'
              ? '候选待办 · 待你确认'
              : task.status === 'confirmed'
                ? '已确认 · 演示'
                : '已完成 · 演示'}
          </Badge>
          <Text
            style={[styles.title, task.status === 'done' && { textDecorationLine: 'line-through' }]}
          >
            {task.title}
          </Text>
          <Text style={styles.muted}>{formatDate(task.dueAt, state.timezone)}</Text>
          {task.status !== 'done' && (
            <Button
              title={task.status === 'proposed' ? '确认演示待办' : '标记演示完成'}
              onPress={() => dispatch({ type: 'task', id: task.id })}
            />
          )}
          <Button
            secondary
            title="查看事项来源"
            onPress={() => router.push({ pathname: '/record/[id]', params: { id: task.recordId } })}
          />
        </Card>
      ))}
    </Page>
  );
}
