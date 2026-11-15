import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Card, styles } from './ui';

export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  secure = false,
  editable = true,
  maxLength = 200,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  secure?: boolean;
  editable?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.small}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        secureTextEntry={secure}
        editable={editable}
        maxLength={maxLength}
        autoCapitalize="none"
        style={[styles.input, multiline && { minHeight: 140, textAlignVertical: 'top' }]}
      />
    </View>
  );
}
export function WorkspaceNav() {
  return (
    <View style={[styles.row, { justifyContent: 'flex-start' }]}>
      <Button secondary title="文字记录" onPress={() => router.push('/workspace')} />
      <Button secondary title="候选记忆" onPress={() => router.push('/workspace/memories')} />
      <Button secondary title="来源问答" onPress={() => router.push('/workspace/ask')} />
      <Button secondary title="设备配对" onPress={() => router.push('/workspace/pair')} />
    </View>
  );
}
export function Notice({ children }: { children?: string }) {
  return children ? (
    <Card tint>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        {children}
      </Text>
    </Card>
  ) : null;
}
export function useResource<T>(loader: () => Promise<T | null>, refreshKey: unknown = null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loader()
      .then((value) => {
        if (active) {
          setData(value);
          setError('');
        }
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : '读取失败，请重试。');
      });
    return () => {
      active = false;
    };
  }, [loader, refreshKey]);
  return { data, error };
}
export const reviewLabels: Record<string, string> = {
  unreviewed_source: '原文陈述 · 未核实',
  candidate: '候选 · 待核实',
  needs_review: '待复核',
  verified_by_user: '人工确认',
  rejected: '已驳回',
  superseded: '旧版本 · 不作当前依据',
};
export function codePointExcerpt(text: string, start: number, end: number) {
  return Array.from(text).slice(start, end).join('');
}
