export type WorkflowOperation = 'createBranch' | 'stage' | 'commit' | 'splitChanges' | 'verify';

export type OperationOutcome = 'executed' | 'skipped' | 'failed';

export interface OperationDecision {
  operation: WorkflowOperation;
  outcome: OperationOutcome;
  description: string;
  reason?: string;
}

export interface WorkflowDecision {
  operations: OperationDecision[];
  success: boolean;
  failure?: string;
}
