import { Stack } from 'expo-router';
import { WorkspaceProvider } from '../../services/workspace-state';
export default function WorkspaceLayout() {
  return (
    <WorkspaceProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WorkspaceProvider>
  );
}
