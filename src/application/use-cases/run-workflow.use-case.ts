import {
  InsufficientContextError,
  InvalidBranchNameError,
  NoRepositoryError,
  PlanValidationError,
  UnsafeRepositoryStateError,
  VerificationError,
} from '../../domain/errors/domain-errors.js';
import { PolicyEvaluator } from '../../domain/policy/policy-evaluator.js';
import type { RepositorySnapshot } from '../../domain/repository/repository-snapshot.js';
import { hasRepositoryStateChanged } from '../../domain/repository/snapshot-comparison.js';
import type { WorkflowDecision } from '../../domain/workflow/workflow-decision.js';
import type { WorkflowPlan } from '../../domain/workflow/workflow-plan.js';
import { toErrorMessage } from '../../shared/errors.js';
import type { AiPlannerFactory } from '../ports/ai-planner.port.js';
import type { ApprovalPort } from '../ports/approval.port.js';
import type { ConfigurationService } from '../ports/configuration.port.js';
import type { InstructionLoader } from '../ports/instruction-loader.port.js';
import type { ProgressReporter } from '../ports/progress.port.js';
import type { RepositoryAdapter } from '../ports/repository.port.js';
import type { TemplateLoaderPort } from '../ports/template-loader.port.js';
import type { CommitTemplate } from '../../domain/templates/commit-template.js';
import { WorkflowExecutor } from '../services/workflow-executor.service.js';
import { WorkflowValidator } from '../services/workflow-validator.service.js';
import type { PlanPersistence } from '../../infrastructure/persistence/plan-persistence.js';
import type { StatePersistence } from '../../infrastructure/persistence/workflow-state.js';

export type WorkflowStatus = 'completed' | 'failed' | 'no-changes' | 'planned';

export interface WorkflowRunResult {
  status: WorkflowStatus;
  snapshot: RepositorySnapshot;
  plan?: WorkflowPlan;
  provider?: string;
  modelId?: string;
  decision?: WorkflowDecision;
  verification?: RepositorySnapshot;
  failure?: string;
}

export interface RunWorkflowOptions {
  cwd: string;
  dryRun?: boolean;
  resume?: boolean;
}

export interface RunWorkflowDependencies {
  repository: RepositoryAdapter;
  configService: ConfigurationService;
  instructionLoader: InstructionLoader;
  templateLoader: TemplateLoaderPort;
  plannerFactory: AiPlannerFactory;
  approval: ApprovalPort;
  progress: ProgressReporter;
  planPersistence: PlanPersistence;
  statePersistence: StatePersistence;
}

export class RunWorkflowUseCase {
  constructor(private readonly dependencies: RunWorkflowDependencies) {}

  async execute(options: RunWorkflowOptions): Promise<WorkflowRunResult> {
    try {
      return await this.run(options);
    } catch (error) {
      this.dependencies.progress.emit({ type: 'workflow.failed', message: toErrorMessage(error) });
      throw error;
    }
  }

  private async run(options: RunWorkflowOptions): Promise<WorkflowRunResult> {
    const { repository, configService, instructionLoader, templateLoader, plannerFactory, planPersistence, statePersistence } =
      this.dependencies;
    const { progress } = this.dependencies;
    const { resume = false, dryRun } = options;

    progress.emit({ type: 'repository.detecting' });
    const location = await repository.detect(options.cwd);
    if (location === null) {
      throw new NoRepositoryError(`No Git repository found at or above ${options.cwd}.`);
    }

    progress.emit({ type: 'repository.inspecting' });
    const currentSnapshot = await repository.inspect();

    if (currentSnapshot.changes.length === 0) {
      return { status: 'no-changes', snapshot: currentSnapshot };
    }

    let plan: WorkflowPlan;
    let template: CommitTemplate | null = null;

    if (resume) {
      progress.emit({ type: 'plan.loading' });
      const savedPlan = await planPersistence.loadPlan(location.rootPath);
      if (savedPlan === null) {
        throw new Error(`No saved plan found in ${location.rootPath}/.gus/workflow-plan.json. Run gus first to create a plan.`);
      }

      // Check for new changes since plan was saved
      const assignedFiles = new Set<string>();
      for (const commit of savedPlan.commits) {
        for (const file of commit.files) {
          assignedFiles.add(file);
        }
      }
      const newChanges = currentSnapshot.changes.filter((change) => !assignedFiles.has(change.path));
      if (newChanges.length > 0) {
        throw new Error(
          `Repository has changed since the plan was saved. ${newChanges.length} new change(s) detected: ${newChanges.map((c) => c.path).join(', ')}. ` +
            'Please commit or stash these changes, or run gus without --resume.',
        );
      }

      plan = savedPlan;
    } else {
      progress.emit({ type: 'repository.collecting' });
      const changeContents = await repository.getChangeContents(currentSnapshot.changes);
      const omittedPaths = changeContents
        .filter((content) => content.contentOmitted)
        .map((content) => content.path);
      if (omittedPaths.length > 0) {
        throw new InsufficientContextError(
          `Gus could not collect the full content of ${omittedPaths.length} changed file(s) (${omittedPaths.join(', ')}). The change set is too large to plan reliably. Review the changes manually or split the work into smaller steps.`,
          omittedPaths,
        );
      }

      progress.emit({ type: 'configuration.loading' });
      const configuration = await configService.getMerged(currentSnapshot.rootPath);

      progress.emit({ type: 'instructions.loading' });
      const instructions = await instructionLoader.loadInstructions(currentSnapshot.rootPath);

      progress.emit({ type: 'template.loading' });
      template = await templateLoader.loadTemplate(currentSnapshot.rootPath);

      progress.emit({ type: 'ai.planning' });
      const resolved = plannerFactory.create(configuration);
      plan = await resolved.planner.plan({
        repositorySnapshot: currentSnapshot,
        changes: currentSnapshot.changes,
        changeContents,
        instructions: instructions.combined,
        ...(template !== null ? { template } : {}),
        ...(configuration.workflow?.commitStyle !== undefined
          ? { commitStyle: configuration.workflow.commitStyle }
          : {}),
        ...(configuration.workflow?.defaultBranch !== undefined
          ? { defaultBranch: configuration.workflow.defaultBranch }
          : {}),
        currentBranch: currentSnapshot.currentBranch,
      });

      // Save the plan for future resume
      await planPersistence.savePlan(plan, currentSnapshot.rootPath);
    }

    progress.emit({ type: 'plan.validating' });
    const validation = new WorkflowValidator().validate(plan, currentSnapshot, template);
    if (!validation.valid) {
      throw new PlanValidationError(
        `The AI workflow plan is not safe to execute: ${validation.errors.join('; ')}`,
        validation.errors,
      );
    }

    if (plan.branch.strategy === 'new' && plan.branch.name !== undefined) {
      await repository.validateBranchName(plan.branch.name);
    }

    const configuration = await configService.getMerged(currentSnapshot.rootPath);
    const policy = new PolicyEvaluator().evaluate(plan, {
      autoCommit: configuration.workflow?.autoCommit ?? 'ask',
      autoCreateBranch: configuration.workflow?.autoCreateBranch ?? 'ask',
      autoStage: configuration.workflow?.autoStage ?? 'ask',
      splitChanges: configuration.workflow?.splitChanges ?? 'ask',
    });

    if (dryRun === true) {
      return {
        status: 'planned',
        snapshot: currentSnapshot,
        plan,
        provider: 'resume',
        modelId: 'resume',
      };
    }

    const current = await repository.inspect();
    if (hasRepositoryStateChanged(currentSnapshot, current)) {
      throw new UnsafeRepositoryStateError(
        'The repository changed while Gus was planning. Re-run the workflow so the plan matches the current state.',
      );
    }

    const executor = new WorkflowExecutor(repository);
    const decision = await executor.execute(plan, policy, {
      approval: this.dependencies.approval,
      progress,
      statePersistence,
      rootPath: currentSnapshot.rootPath,
    });

    if (!decision.success) {
      progress.emit({
        type: 'workflow.failed',
        message: decision.failure ?? 'The workflow did not complete.',
      });
      return {
        status: 'failed',
        snapshot: currentSnapshot,
        plan,
        provider: 'resume',
        modelId: 'resume',
        decision,
        failure: decision.failure,
      };
    }

    progress.emit({ type: 'repository.verifying' });
    const verification = await repository.verify();

    if (verification.changes.length > 0) {
      const remaining = verification.changes.map((change) => change.path).join(', ');
      throw new VerificationError(
        `The workflow finished but the repository is not clean. Remaining changes: ${remaining}`,
      );
    }

    // Save execution state after successful completion
    await statePersistence.saveState(
      {
        branchCreated: plan.branch.strategy === 'new' && plan.branch.name !== undefined,
        commitsCompleted: plan.commits.length,
      },
      currentSnapshot.rootPath,
    );

    progress.emit({ type: 'workflow.completed', success: true });

    return {
      status: 'completed',
      snapshot: currentSnapshot,
      plan,
      provider: 'resume',
      modelId: 'resume',
      decision,
      verification,
    };
  }
}
