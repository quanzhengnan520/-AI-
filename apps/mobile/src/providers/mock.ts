import type { DemoAnswer, DemoState, Evidence } from '../types/domain';

const octoberId = '0cbdc86e-4e98-4c67-87bf-235451f60201';
const novemberId = '0cbdc86e-4e98-4c67-87bf-235451f60202';
const planningId = '0cbdc86e-4e98-4c67-87bf-235451f60203';
const octoberBody = '王总说：项目预算预计200万元，尚未正式审批。';
const novemberBody = '王总说：目前只能考虑150万元，审批结果还需要确认。';

export const sampleQuestions = ['王总的预算有什么变化？', '预算已经批准了吗？', '合同已经签了吗？'];

export function createDemoState(): DemoState {
  return {
    timezone: 'Asia/Shanghai',
    retentionDays: 30,
    excerptConsent: false,
    records: [
      {
        id: novemberId,
        title: '项目预算 · 最新沟通',
        capturedAt: '2026-11-12T07:30:00Z',
        body: novemberBody,
        tag: '青岚项目',
        status: 'needs_review',
        audioAvailable: false,
        version: 1,
      },
      {
        id: planningId,
        title: '下一次会前准备',
        capturedAt: '2026-11-10T01:00:00Z',
        body: '下次沟通前，需要核实预算审批进度，并整理两个版本的方案。尚未确认会议日期。',
        tag: '工作安排',
        status: 'ready',
        audioAvailable: false,
        version: 1,
      },
      {
        id: octoberId,
        title: '项目预算 · 初步讨论',
        capturedAt: '2026-10-15T06:00:00Z',
        body: octoberBody,
        tag: '青岚项目',
        status: 'ready',
        audioAvailable: false,
        version: 1,
      },
    ],
    memories: [
      {
        id: '6d1b887e-551f-4acd-a946-d50652a43e01',
        title: '王总目前口头考虑的预算为150万元。',
        subject: '王总',
        category: 'statement',
        status: 'candidate',
        recordedAt: '2026-11-12T07:30:00Z',
        eventTime: '2026-11-12T07:30:00Z',
        evidence: { recordId: novemberId, startChar: 0, endChar: novemberBody.length },
        version: 1,
      },
      {
        id: '6d1b887e-551f-4acd-a946-d50652a43e02',
        title: '10月预计预算为200万元，当时尚未审批。',
        subject: '王总',
        category: 'statement',
        status: 'verified_by_user',
        recordedAt: '2026-10-15T06:00:00Z',
        eventTime: '2026-10-15T06:00:00Z',
        evidence: { recordId: octoberId, startChar: 0, endChar: octoberBody.length },
        version: 1,
      },
      {
        id: '6d1b887e-551f-4acd-a946-d50652a43e03',
        title: '预算表述变化可能需要进一步核实原因。',
        subject: '青岚项目',
        category: 'hypothesis',
        status: 'candidate',
        recordedAt: '2026-11-12T07:30:00Z',
        eventTime: '2026-11-12T07:30:00Z',
        evidence: { recordId: novemberId, startChar: 0, endChar: novemberBody.length },
        version: 1,
      },
    ],
    tasks: [
      {
        id: '84c6ce08-932f-4680-8804-4d5050630c01',
        title: '核实预算的正式审批进度',
        dueAt: '2026-11-16T02:00:00Z',
        status: 'proposed',
        recordId: novemberId,
      },
      {
        id: '84c6ce08-932f-4680-8804-4d5050630c02',
        title: '整理两个预算版本的方案',
        dueAt: '2026-11-17T06:00:00Z',
        status: 'confirmed',
        recordId: planningId,
      },
    ],
  };
}

// M0 固定演示协议，不是语义检索，也没有模型调用。
export function answerDemoQuestion(question: string, state: DemoState): DemoAnswer {
  if (sampleQuestions.slice(0, 2).includes(question.trim())) {
    const citations: Evidence[] = state.records
      .filter((record) => record.id === octoberId || record.id === novemberId)
      .map((record) => ({ recordId: record.id, startChar: 0, endChar: record.body.length }));
    if (citations.length === 2) {
      return {
        answer:
          '10月记录提到“预计200万元，尚未正式审批”；11月的口头表述变成“目前只能考虑150万元”。两次说法发生了变化，现有资料无法确认预算已批准，也不足以判断变化原因。',
        citations,
        certainty: 'supported_with_limits',
        limitations: '缺少正式审批结果；口头表述不等于最终承诺。',
      };
    }
  }
  return {
    answer: '无法从现有资料确认。我没有找到足以确认这件事的记录，可以补充相关资料。',
    citations: [],
    certainty: 'insufficient_evidence',
    limitations: 'M0 仅对上方预算示例展示预设回答，其他问题统一演示“依据不足”。',
  };
}
