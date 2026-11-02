import type { ApprovalOperation } from './approval.port.js';

export type WorkflowProgressEvent =
  | { type: 'repository.detecting' }
  | { type: 'repository.inspecting' }
  | { type: 'repository.collecting' }
  | { type: 'configuration.loading' }
  | { type: 'instructions.loading' }
  | { type: 'template.loading' }
  | { type: 'ai.planning' }
  | { type: 'plan.loading' }
  | { type: 'plan.validating' }
  | { type: 'approval.required'; operation: ApprovalOperation }
  | { type: 'branch.creating'; name: string }
  | { type: 'commit.creating'; index: number; total: number }
  | { type: 'repository.verifying' }
  | { type: 'workflow.completed'; success: boolean }
  | { type: 'workflow.failed'; message: string };

export interface ProgressReporter {
  emit(event: WorkflowProgressEvent): void;
}

export class NullProgressReporter implements ProgressReporter {
  emit(): void {
    return;
  }
}
