import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RepositorySnapshot } from '../../domain/repository/repository-snapshot.js';
import type { WorkflowPlan } from '../../domain/workflow/workflow-plan.js';

const PLAN_FILE = 'workflow-plan.json';

export interface PlanPersistence {
  savePlan(plan: WorkflowPlan, rootPath: string): Promise<void>;
  loadPlan(rootPath: string): Promise<WorkflowPlan | null>;
  deletePlan(rootPath: string): Promise<void>;
}

export async function savePlan(plan: WorkflowPlan, rootPath: string): Promise<void> {
  const planPath = join(rootPath, '.gus', PLAN_FILE);
  await writeFile(planPath, JSON.stringify(plan, null, 2));
}

export async function loadPlan(rootPath: string): Promise<WorkflowPlan | null> {
  const planPath = join(rootPath, '.gus', PLAN_FILE);
  try {
    const content = await readFile(planPath, 'utf-8');
    return JSON.parse(content) as WorkflowPlan;
  } catch {
    return null;
  }
}

export async function deletePlan(rootPath: string): Promise<void> {
  const planPath = join(rootPath, '.gus', PLAN_FILE);
  try {
    await writeFile(planPath, '');
  } catch {
    /* ignore */
  }
}
