import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '../../components/ui';

export default function TabLayout() {
  const icon = (symbol: string) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Text style={{ fontSize: 22, color }}>{symbol}</Text>;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: '#8C99AB',
        tabBarStyle: {
          borderTopColor: '#E8EDF4',
          backgroundColor: '#FFFFFF',
          height: 84,
          paddingTop: 10,
          paddingBottom: 22,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: 4 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '今天', tabBarIcon: icon('◷') }} />
      <Tabs.Screen name="records" options={{ title: '记录', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="memories" options={{ title: '记忆', tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="settings" options={{ title: '我的', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
