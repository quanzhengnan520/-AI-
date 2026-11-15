import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button, colors, DemoBanner, styles } from './ui';

export function RecordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <RecordingSession onClose={onClose} /> : null;
}

function RecordingSession({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'ready' | 'recording' | 'paused' | 'finished'>('ready');
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (status !== 'recording') return;
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);
  const duration = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheet.overlay}>
        <View style={sheet.content}>
          <View style={sheet.handle} />
          <DemoBanner />
          <Text style={styles.title}>记录每一个重要时刻</Text>
          <Text style={styles.body}>真实录音前，请确认已获得参与者所需同意。</Text>
          <Text style={styles.muted}>当前仅模拟计时；不会申请麦克风、录制、保存或上传音频。</Text>
          <View style={sheet.timer}>
            <Text style={sheet.duration}>{duration}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              {
                {
                  ready: '准备开始演示',
                  recording: '● 模拟记录中',
                  paused: '演示已暂停',
                  finished: '演示结束 · 未生成音频文件',
                }[status]
              }
            </Text>
          </View>
          {status === 'ready' && (
            <Button title="确认并开始演示" onPress={() => setStatus('recording')} />
          )}
          {(status === 'recording' || status === 'paused') && (
            <>
              <Button
                title={status === 'recording' ? '暂停演示' : '继续演示'}
                secondary
                onPress={() => setStatus(status === 'recording' ? 'paused' : 'recording')}
              />
              <Button title="完成演示" onPress={() => setStatus('finished')} />
            </>
          )}
          {status === 'finished' && (
            <Text style={styles.body}>
              本次仅体验操作流程，没有创建记录。真实文字记录与音频保存将在后续阶段实现。
            </Text>
          )}
          <Button
            title={status === 'finished' ? '返回今天' : '关闭演示'}
            secondary
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}
const sheet = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#15243D55' },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 15,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#D9DFE9',
    alignSelf: 'center',
    marginBottom: 5,
  },
  timer: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  duration: {
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    fontSize: 52,
    letterSpacing: 2,
    fontWeight: '300',
  },
});
