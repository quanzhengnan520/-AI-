import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Badge, Button, Card, colors, Page, Section, styles } from '../../components/ui';
import { createDemoState } from '../../providers/mock';
import { apiBaseUrl, checkLocalConnection } from '../../services/connection';
import { useDemo } from '../../services/demo-state';
export default function SettingsScreen() {
  const { state, dispatch } = useDemo();
  const [connection, setConnection] = useState('尚未连接 · 默认不发起网络请求');
  const [busy, setBusy] = useState(false);
  async function check() {
    if (busy) return;
    setBusy(true);
    try {
      setConnection(await checkLocalConnection());
    } catch (error) {
      setConnection(error instanceof Error ? error.message : '连接失败，请重试。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="我的" subtitle="你的资料，由你掌控">
      <Card>
        <View style={styles.row}>
          <Text style={styles.title}>当前运行模式</Text>
          <Badge>Mock 演示</Badge>
        </View>
        <Text style={styles.body}>
          页面数据来自本机合成样本，不代表真实识别或分析结果。全部操作只在本次会话生效，刷新或重启后恢复。
        </Text>
        <Text style={styles.muted}>模型：Mock · ASR：未启用 · 云端调用：0 次</Text>
        <Button title="Live 模式 · 后续阶段开放" disabled onPress={() => {}} secondary />
      </Card>
      <Section title="连接与权限" />
      <Card>
        <Text style={styles.title}>本地后端连接测试</Text>
        <Text style={styles.muted}>
          主动点击后，仅读取健康状态与 API 版本。不发送问题、记录或个人资料，页面继续使用演示样本。
        </Text>
        <Text selectable style={styles.small}>
          {apiBaseUrl}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {connection}
        </Text>
        <Button
          title={busy ? '正在检查…' : '测试本地 API 连接'}
          disabled={busy}
          onPress={() => {
            void check();
          }}
        />
        <View style={styles.divider} />
        <Text style={styles.muted}>麦克风：未申请 · 通知：未申请</Text>
      </Card>
      <Section title="资料保留 · 演示设置" />
      <Card>
        <Text style={styles.title}>原始资料保留 {state.retentionDays} 天</Text>
        <Text style={styles.muted}>默认 30 天。这里仅体验设置，不执行真实保存或清理。</Text>
        <View style={styles.row}>
          {[7, 30, 90].map((days) => (
            <View key={days} style={{ flex: 1 }}>
              <Button
                title={`${days} 天`}
                secondary={state.retentionDays !== days}
                onPress={() => dispatch({ type: 'retention', value: days })}
              />
            </View>
          ))}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.body}>长期保留关键原话摘录</Text>
            <Text style={styles.small}>仅演示开关；不会实际保留个人资料。</Text>
          </View>
          <Switch
            accessibilityLabel="演示原话摘录保留许可"
            value={state.excerptConsent}
            onValueChange={(value) => dispatch({ type: 'excerpt', value })}
            trackColor={{ true: colors.blue }}
          />
        </View>
      </Card>
      <Section title="显示时区" />
      <Card>
        <Text style={styles.body}>{state.timezone}</Text>
        <Button
          secondary
          title={state.timezone === 'Asia/Shanghai' ? '切换为 UTC' : '切换为 Asia/Shanghai'}
          onPress={() =>
            dispatch({
              type: 'timezone',
              value: state.timezone === 'Asia/Shanghai' ? 'UTC' : 'Asia/Shanghai',
            })
          }
        />
        <Text style={styles.small}>底层时间样本为 UTC；页面按所选时区显示。</Text>
      </Card>
      <Section title="数据与关于" />
      <Card>
        <Text style={styles.body}>导出与删除：后续阶段开放</Text>
        <Text style={styles.muted}>
          M0 没有真实个人资料库。这里不显示未经执行的导出或删除成功状态。
        </Text>
        <Text style={styles.small}>
          当前只验证交互与工程骨架；后台录音、系统通知、端到端加密和多端同步尚未验证。
        </Text>
        <Button
          secondary
          title="重置本次演示状态"
          onPress={() => {
            dispatch({ type: 'reset', state: createDemoState() });
            setConnection('尚未连接 · 默认不发起网络请求');
          }}
        />
      </Card>
    </Page>
  );
}
