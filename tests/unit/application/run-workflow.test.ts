import { describe, expect, it, vi } from 'vitest';
import type { AiPlanner, AiPlannerFactory } from '../../../src/application/ports/ai-planner.port';
import type { ApprovalOutcome, ApprovalPort } from '../../../src/application/ports/approval.port';
import type { ConfigurationService } from '../../../src/application/ports/configuration.port';
import type { InstructionLoader } from '../../../src/application/ports/instruction-loader.port';
import { NullProgressReporter } from '../../../src/application/ports/progress.port';
import type {
  CommitResult,
  RepositoryAdapter,
  RepositoryLocation,
} from '../../../src/application/ports/repository.port';
import type { TemplateLoaderPort } from '../../../src/application/ports/template-loader.port';
import { RunWorkflowUseCase } from '../../../src/application/use-cases/run-workflow.use-case';
import {
  ApprovalRequiredError,
  InsufficientContextError,
  NoRepositoryError,
  PlanValidationError,
  UnsafeRepositoryStateError,
} from '../../../src/domain/errors/domain-errors';
import type { ChangeContent } from '../../../src/domain/repository/change-content';
import type { RepositoryCapabilities } from '../../../src/domain/repository/repository-capabilities';
import type { RepositoryChange } from '../../../src/domain/repository/repository-change';
import type { RepositorySnapshot } from '../../../src/domain/repository/repository-snapshot';
import type { WorkflowPlan } from '../../../src/domain/workflow/workflow-plan';

function snapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    rootPath: '/repo',
    displayName: 'repo',
    currentBranch: 'main',
    isDetached: false,
    isOperationInProgress: false,
    changes: [{ path: 'a.ts', status: 'modified', stagingState: 'unstaged' }],
    headSha: 'head-1',
    indexFingerprint: 'index-1',
    worktreeFingerprint: 'worktree-1',
    ...overrides,
  };
}

function plan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    summary: 'plan',
    branch: { strategy: 'current', reason: 'stay' },
    commits: [{ message: 'feat: change a', files: ['a.ts'] }],
    warnings: [],
    ...overrides,
  };
}

class FakeRepository implements RepositoryAdapter {
  snapshots: RepositorySnapshot[];
  commits: string[] = [];
  verifyCalls = 0;
  failCommit = false;
  changeContents: ChangeContent[] | null = null;
  getChangeContentsCalls = 0;

  constructor(snapshots: RepositorySnapshot[] = [snapshot(), snapshot()]) {
    this.snapshots = snapshots;
  }

  async detect(_cwd: string): Promise<RepositoryLocation | null> {
    return { rootPath: '/repo', displayName: 'repo' };
  }

  async getCapabilities(): Promise<RepositoryCapabilities> {
    return {
      canCreateBranch: true,
      canCheckoutBranch: true,
      canStagePaths: true,
      canCommit: true,
      supportsRenameDetection: true,
    };
  }

  async inspect(): Promise<RepositorySnapshot> {
    const next = this.snapshots.shift();
    return next ?? snapshot({ changes: [] });
  }

  async getChangeContents(changes: RepositoryChange[]): Promise<ChangeContent[]> {
    this.getChangeContentsCalls += 1;
    if (this.changeContents !== null) {
      return this.changeContents;
    }
    return changes.map((change) => ({
      path: change.path,
      ...(change.oldPath !== undefined ? { oldPath: change.oldPath } : {}),
      status: change.status,
      stagingState: change.stagingState,
      stagedDiff: '',
      unstagedDiff: '',
      addedContent: '',
      truncated: false,
      contentOmitted: false,
    }));
  }

  async validateBranchName(_name: string): Promise<void> {}

  async branchExists(_name: string): Promise<boolean> {
    return false;
  }

  async createBranch(_name: string): Promise<void> {}

  async checkoutBranch(_name: string): Promise<void> {}

  async stagePaths(_paths: string[]): Promise<void> {}

  async getStagedPaths(): Promise<string[]> {
    return [];
  }

  async commit(message: string): Promise<CommitResult> {
    if (this.failCommit) {
      throw new Error('boom');
    }
    this.commits.push(message);
    return { sha: 'abcdef1234567890', message };
  }

  async verify(): Promise<RepositorySnapshot> {
    this.verifyCalls += 1;
    return snapshot({ changes: [] });
  }
}

class FakeConfigService implements ConfigurationService {
  constructor(private readonly workflow: Record<string, 'allow' | 'ask' | 'deny'> = {}) {}

  async getMerged(): Promise<{
    ai: { provider: string };
    workflow: Record<string, 'allow' | 'ask' | 'deny'>;
  }> {
    return {
      ai: { provider: 'openai' },
      workflow: {
        autoCommit: 'allow',
        autoCreateBranch: 'allow',
        autoStage: 'allow',
        splitChanges: 'allow',
        ...this.workflow,
      },
    };
  }

  async getResolved() {
    return { configuration: await this.getMerged(), sources: {} };
  }

  async read() {
    return {};
  }

  async write() {
    return {};
  }

  getLocation(): string {
    return '/tmp/config.json';
  }
}

function plannerFactory(returnedPlan: WorkflowPlan): {
  factory: AiPlannerFactory;
  plan: ReturnType<typeof vi.fn>;
} {
  const planSpy = vi.fn(async () => returnedPlan);
  const planner: AiPlanner = { plan: planSpy };
  return {
    plan: planSpy,
    factory: {
      create: () => ({ provider: 'openai', modelId: 'gpt-4o-mini', planner }),
    },
  };
}

function createUseCase(
  repository: FakeRepository,
  returnedPlan: WorkflowPlan = plan(),
  outcome: ApprovalOutcome = 'approved',
  workflow: Record<string, 'allow' | 'ask' | 'deny'> = {},
) {
  const planner = plannerFactory(returnedPlan);
  type PlanEntry = { plan: unknown };
  const planStore: Record<string, PlanEntry> = {};
  const planPersistence = {
    savePlan: async (plan: unknown, rootPath: string) => {
      planStore[rootPath] = { plan };
    },
    loadPlan: async (rootPath: string) => {
      const stored = planStore[rootPath];
      return stored ? stored.plan : null;
    },
  };
  type StateEntry = { state: unknown };
  const stateStore: Record<string, StateEntry> = {};
  const statePersistence = {
    saveState: async (state: unknown, rootPath: string) => {
      stateStore[rootPath] = { state };
    },
    loadState: async (rootPath: string) => {
      const stored = stateStore[rootPath];
      return stored ? stored.state : null;
    },
  };
  const useCase = new RunWorkflowUseCase({
    repository,
    configService: new FakeConfigService(workflow),
    instructionLoader: {
      loadInstructions: async () => ({
        globalInstructions: '',
        projectInstructions: '',
        combined: 'instructions',
        sources: [],
      }),
    } satisfies InstructionLoader,
    templateLoader: { loadTemplate: async () => null } satisfies TemplateLoaderPort,
    plannerFactory: planner.factory,
    approval: { requestApproval: async () => outcome } satisfies ApprovalPort,
    progress: new NullProgressReporter(),
    planPersistence,
    statePersistence,
  });

  return { useCase, planner };
}

describe('RunWorkflowUseCase', () => {
  it('reports when there is no repository', async () => {
    const repository = new FakeRepository();
    repository.detect = async () => null;
    const { useCase } = createUseCase(repository);

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toBeInstanceOf(NoRepositoryError);
  });

  it('short-circuits when there are no changes', async () => {
    const repository = new FakeRepository([snapshot({ changes: [] })]);
    const { useCase, planner } = createUseCase(repository);

    const result = await useCase.execute({ cwd: '/repo' });

    expect(result.status).toBe('no-changes');
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it('previews a plan in dry-run mode without mutating the repository', async () => {
    const repository = new FakeRepository();
    const { useCase } = createUseCase(repository);

    const result = await useCase.execute({ cwd: '/repo', dryRun: true });

    expect(result.status).toBe('planned');
    expect(result.plan).toEqual(plan());
    expect(repository.commits).toEqual([]);
  });

  it('rejects an unsafe plan before execution', async () => {
    const repository = new FakeRepository();
    const { useCase } = createUseCase(repository, plan({ commits: [] }));

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toBeInstanceOf(PlanValidationError);
    expect(repository.commits).toEqual([]);
  });

  it('executes and verifies a valid plan', async () => {
    const repository = new FakeRepository();
    const { useCase } = createUseCase(repository);

    const result = await useCase.execute({ cwd: '/repo' });

    expect(result.status).toBe('completed');
    expect(repository.commits).toEqual(['feat: change a']);
    expect(repository.verifyCalls).toBe(1);
  });

  it('refuses to execute a stale plan', async () => {
    const repository = new FakeRepository([snapshot(), snapshot({ currentBranch: 'other' })]);
    const { useCase } = createUseCase(repository);

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toBeInstanceOf(
      UnsafeRepositoryStateError,
    );
    expect(repository.commits).toEqual([]);
  });

  it('refuses to execute a plan when the worktree content changed during planning', async () => {
    const repository = new FakeRepository([
      snapshot({ worktreeFingerprint: 'worktree-1' }),
      snapshot({ worktreeFingerprint: 'worktree-2' }),
    ]);
    const { useCase } = createUseCase(repository);

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toThrow(UnsafeRepositoryStateError);
    expect(repository.commits).toEqual([]);
  });

  it('reports partial failure without claiming success', async () => {
    const repository = new FakeRepository();
    repository.failCommit = true;
    const { useCase } = createUseCase(repository);

    const result = await useCase.execute({ cwd: '/repo' });

    expect(result.status).toBe('failed');
    expect(result.failure).toBeDefined();
    expect(result.decision?.success).toBe(false);
  });

  it('refuses to plan when the repository content could not be collected', async () => {
    const repository = new FakeRepository();
    repository.changeContents = [
      {
        path: 'a.ts',
        status: 'modified',
        stagingState: 'unstaged',
        stagedDiff: '',
        unstagedDiff: '',
        addedContent: '',
        truncated: false,
        contentOmitted: true,
      },
    ];
    const { useCase, planner } = createUseCase(repository);

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toBeInstanceOf(
      InsufficientContextError,
    );
    expect(planner.plan).not.toHaveBeenCalled();
    expect(repository.commits).toEqual([]);
  });

  it('reports the omitted paths when the repository content is incomplete', async () => {
    const repository = new FakeRepository();
    repository.changeContents = [
      {
        path: 'a.ts',
        status: 'modified',
        stagingState: 'unstaged',
        stagedDiff: '',
        unstagedDiff: '',
        addedContent: '',
        truncated: false,
        contentOmitted: true,
      },
    ];
    const { useCase } = createUseCase(repository);

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toMatchObject({
      name: 'InsufficientContextError',
      omittedPaths: ['a.ts'],
    });
  });

  it('fails safely when approval is unavailable', async () => {
    const repository = new FakeRepository();
    const { useCase } = createUseCase(repository, plan(), 'unavailable', {
      autoCommit: 'ask',
    });

    await expect(useCase.execute({ cwd: '/repo' })).rejects.toBeInstanceOf(ApprovalRequiredError);
  });
});
