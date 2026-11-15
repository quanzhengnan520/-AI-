import type { PropsWithChildren } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  blue: '#2463EB',
  ink: '#15243D',
  muted: '#718096',
  background: '#F4F6FA',
  line: '#E8EDF4',
  pale: '#EBF2FF',
  green: '#16806A',
  amber: '#9B630A',
};

export function Page({
  children,
  title,
  subtitle,
  action,
}: PropsWithChildren<{ title: string; subtitle?: string; action?: React.ReactNode }>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>SECOND BRAIN · POC 00</Text>
            <Text accessibilityRole="header" style={styles.heading}>
              {title}
            </Text>
            {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
          </View>
          {action}
        </View>
        <DemoBanner />
        {children}
        <Text style={styles.footer}>演示数据 · 所有人物与项目均为虚构</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
export function DemoBanner() {
  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <Text style={styles.bannerText}>Mock 演示 · 不代表真实识别或分析结果</Text>
    </View>
  );
}
export function Card({ children, tint = false }: PropsWithChildren<{ tint?: boolean }>) {
  return <View style={[styles.card, tint && styles.tint]}>{children}</View>;
}
export function Badge({
  children,
  tone = 'blue',
}: PropsWithChildren<{ tone?: 'blue' | 'amber' | 'green' | 'gray' }>) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: { blue: '#EBF2FF', amber: '#FFF3DD', green: '#E5F5EF', gray: '#EDF0F5' }[
            tone
          ],
        },
      ]}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: {
            blue: colors.blue,
            amber: colors.amber,
            green: colors.green,
            gray: colors.muted,
          }[tone],
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.blue }]}>{title}</Text>
    </Pressable>
  );
}
export function Section({
  title,
  link,
  onPress,
}: {
  title: string;
  link?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {link && (
        <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 8 }}>
          <Text style={{ color: colors.blue, fontSize: 13 }}>{link} →</Text>
        </Pressable>
      )}
    </View>
  );
}
export function Empty({ text = '暂时没有匹配的演示内容' }: { text?: string }) {
  return (
    <Card>
      <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 24 }]}>{text}</Text>
    </Card>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    padding: 22,
    paddingBottom: 32,
    gap: 14,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingBottom: 2 },
  kicker: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2.1,
    fontWeight: '700',
    marginBottom: 7,
  },
  heading: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1,
  },
  title: { color: colors.ink, fontSize: 17, lineHeight: 26, fontWeight: '600' },
  body: { color: '#42516A', fontSize: 15, lineHeight: 26 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  banner: {
    backgroundColor: '#FFF5E3',
    flexDirection: 'row',
    gap: 7,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C58C29' },
  bannerText: { color: '#926A25', fontSize: 11, flex: 1, lineHeight: 17 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 20,
    gap: 11,
    ...Platform.select({ web: { boxShadow: '0 2px 14px rgba(27,51,87,0.025)' } }),
  },
  tint: { backgroundColor: colors.pale, borderColor: '#DBE7FF' },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, alignSelf: 'flex-start' },
  button: {
    backgroundColor: colors.blue,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 13,
    alignItems: 'center',
    minHeight: 48,
  },
  secondaryButton: { backgroundColor: colors.pale },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 15,
    color: colors.ink,
    fontSize: 15,
    minHeight: 50,
  },
  footer: { color: '#9BA6B7', fontSize: 10, textAlign: 'center', marginTop: 12 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 3 },
});
