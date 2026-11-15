import { router } from 'expo-router';
import { Button, Empty, Page } from '../components/ui';
export default function NotFound() {
  return (
    <Page title="页面未找到">
      <Empty text="该页面不在当前 M0 演示范围内。" />
      <Button title="返回今天" onPress={() => router.replace('/')} />
    </Page>
  );
}
