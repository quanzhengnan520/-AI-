import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useReducer } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createDemoState } from '../providers/mock';
import { DemoContext, demoReducer } from '../services/demo-state';

export default function RootLayout() {
  const [state, dispatch] = useReducer(demoReducer, undefined, createDemoState);
  return (
    <SafeAreaProvider>
      <DemoContext.Provider value={{ state, dispatch }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#F4F6FA' },
            headerTintColor: '#2463EB',
            headerShadowVisible: false,
            headerBackTitle: '返回',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ask" options={{ title: '问一问' }} />
          <Stack.Screen name="reminders" options={{ title: '待办与提醒' }} />
          <Stack.Screen name="record/[id]" options={{ title: '记录详情' }} />
          <Stack.Screen name="memory/[id]" options={{ title: '记忆详情' }} />
          <Stack.Screen name="workspace" options={{ title: '文字工作区 · M1' }} />
        </Stack>
      </DemoContext.Provider>
    </SafeAreaProvider>
  );
}
