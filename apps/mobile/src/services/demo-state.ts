import { createContext, useContext } from 'react';
import type { DemoState, ReviewStatus } from '../types/domain';

export type DemoAction =
  | { type: 'review'; id: string; status: ReviewStatus }
  | { type: 'task'; id: string }
  | { type: 'timezone'; value: string }
  | { type: 'retention'; value: number }
  | { type: 'excerpt'; value: boolean }
  | { type: 'reset'; state: DemoState };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'review':
      return {
        ...state,
        memories: state.memories.map((fact) =>
          fact.id === action.id
            ? { ...fact, status: action.status, version: fact.version + 1 }
            : fact,
        ),
      };
    case 'task':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id && task.status !== 'done'
            ? { ...task, status: task.status === 'proposed' ? 'confirmed' : 'done' }
            : task,
        ),
      };
    case 'timezone':
      return { ...state, timezone: action.value };
    case 'retention':
      return { ...state, retentionDays: action.value };
    case 'excerpt':
      return { ...state, excerptConsent: action.value };
    case 'reset':
      return action.state;
  }
}

export const DemoContext = createContext<{
  state: DemoState;
  dispatch: React.Dispatch<DemoAction>;
} | null>(null);
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoProvider is required');
  return context;
}

export function formatDate(iso: string, timezone: string, time = true): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(iso));
}
