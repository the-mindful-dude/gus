import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RepositorySnapshot } from '../../domain/repository/repository-snapshot.js';
import type {
  BranchDecision,
  CommitGroup,
  WorkflowPlan,
} from '../../domain/workflow/workflow-plan.js';

const STATE_FILE = 'workflow-state.json';

export interface WorkflowExecutionState {
  branchCreated: boolean;
  commitsCompleted: number;
}

export interface StatePersistence {
  saveState(state: WorkflowExecutionState, rootPath: string): Promise<void>;
  loadState(rootPath: string): Promise<WorkflowExecutionState | null>;
}

export function createInitialState(plan: WorkflowPlan): WorkflowExecutionState {
  return {
    branchCreated: plan.branch.strategy === 'new' && plan.branch.name !== undefined,
    commitsCompleted: 0,
  };
}

export async function saveState(state: WorkflowExecutionState, rootPath: string): Promise<void> {
  const statePath = join(rootPath, '.gus', STATE_FILE);
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

export async function loadState(rootPath: string): Promise<WorkflowExecutionState | null> {
  const statePath = join(rootPath, '.gus', STATE_FILE);
  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as WorkflowExecutionState;
  } catch {
    return null;
  }
}

export async function deleteState(rootPath: string): Promise<void> {
  const statePath = join(rootPath, '.gus', STATE_FILE);
  try {
    await writeFile(statePath, '');
  } catch {
    /* ignore */
  }
}
