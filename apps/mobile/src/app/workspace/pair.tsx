import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { Button, Card, Page, styles } from '../../components/ui';
import { Field, Notice, WorkspaceNav } from '../../components/workspace-ui';
import { apiBaseUrl } from '../../services/connection';
import { useWorkspace } from '../../services/workspace-state';
export default function PairScreen() {
  const workspace = useWorkspace();
  const [code, setCode] = useState('');
  const [name, setName] = useState('我的测试设备');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function pair() {
    setBusy(true);
    try {
      await workspace.pair(code.trim(), name.trim());
      setCode('');
      setMessage('配对成功，可以保存与检索本地资料。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '配对未成功，请检查一次性码。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="设备配对" subtitle="一次性码只用于连接你自己的服务" demo={false}>
      <WorkspaceNav />
      <Card>
        <Text style={styles.body}>本地服务：{apiBaseUrl}</Text>
        <Text style={styles.muted}>
          在电脑上生成一次性配对码，再在本页输入。不要填写模型 API Key。
        </Text>
        <Text style={styles.small}>
          {Platform.OS === 'web'
            ? 'Web 原型：设备令牌仅存当前标签页的 sessionStorage，关闭标签页需重新配对；它可被同源脚本读取，请使用可信本机浏览器。'
            : '设备令牌保存在系统 SecureStore 中，不进入普通草稿存储。'}
        </Text>
        <Text style={styles.small}>
          离线草稿使用未加密持久存储，仅用于虚构测试；切换服务地址后不会把原队列发到另一个地址。
        </Text>
      </Card>
      <Notice>{message || workspace.message}</Notice>
      {workspace.session ? (
        <>
          <Card>
            <Text style={styles.title}>设备已配对</Text>
            <Text selectable style={styles.small}>
              设备 ID：{workspace.session.device_id}
            </Text>
          </Card>
          <Button
            secondary
            title="退出本机配对"
            onPress={() => {
              void workspace.logout().catch(() => setMessage('本机凭据清除失败，请重试。'));
            }}
          />
        </>
      ) : (
        <>
          <Field label="一次性配对码" value={code} onChangeText={setCode} secure maxLength={128} />
          <Field label="设备名称" value={name} onChangeText={setName} maxLength={60} />
          <Button
            title="配对本地服务"
            disabled={busy || !code.trim() || !name.trim()}
            onPress={() => {
              void pair();
            }}
          />
        </>
      )}
    </Page>
  );
}
