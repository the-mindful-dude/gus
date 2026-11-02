import { Command } from 'commander';
import type { ApprovalPort } from '../../application/ports/approval.port.js';
import type { ProgressReporter } from '../../application/ports/progress.port.js';
import { NullProgressReporter } from '../../application/ports/progress.port.js';
import { RunWorkflowUseCase } from '../../application/use-cases/run-workflow.use-case.js';
import type { ConfigurationPatch } from '../../domain/config/configuration.js';
import { ExitCode } from '../../shared/exit-codes.js';
import {
  createConfigService,
  createInstructionLoader,
  createModelResolver,
  createRepository,
  createTemplateLoader,
} from '../composition.js';
import fs from 'node:fs/promises';
import { PlanPersistence } from '../../infrastructure/persistence/plan-persistence.js';
import { StatePersistence } from '../../infrastructure/persistence/workflow-state.js';
import { WorkflowPlan } from '../../domain/workflow/workflow-plan.js';
import { PlanView } from '../ui/plan-view.js';
import { ClackProgressReporter } from '../ui/progress.js';
import { AutoApproval, ClackApproval, NonInteractiveApproval } from '../ui/prompts.js';
import { ResultView } from '../ui/result-view.js';

export interface RunOptions {
  dryRun?: boolean;
  yes?: boolean;
  resume?: boolean;
  provider?: string;
  model?: string;
}

function createPlanPersistence(): PlanPersistence {
  return {
    savePlan: async (plan: WorkflowPlan, rootPath: string) => {
      const planPath = `${rootPath}/.gus/workflow-plan.json`;
      try {
        await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
      } catch {
        /* ignore */
      }
    },
    loadPlan: async (rootPath: string) => {
      const planPath = `${rootPath}/.gus/workflow-plan.json`;
      try {
        const content = await fs.readFile(planPath, 'utf-8');
        return JSON.parse(content) as WorkflowPlan;
      } catch {
        return null;
      }
    },
    deletePlan: async (rootPath: string) => {
      const planPath = `${rootPath}/.gus/workflow-plan.json`;
      try {
        await fs.writeFile(planPath, '');
      } catch {
        /* ignore */
      }
    },
  };
}

function createStatePersistence(): StatePersistence {
  return {
    saveState: async (state: { branchCreated: boolean; commitsCompleted: number }, rootPath: string) => {
      const statePath = `${rootPath}/.gus/workflow-state.json`;
      try {
        await fs.writeFile(statePath, JSON.stringify(state, null, 2));
      } catch {
        /* ignore */
      }
    },
    loadState: async (rootPath: string) => {
      const statePath = `${rootPath}/.gus/workflow-state.json`;
      try {
        const content = await fs.readFile(statePath, 'utf-8');
        return JSON.parse(content) as { branchCreated: boolean; commitsCompleted: number };
      } catch {
        return null;
      }
    },
  };
}

export async function executeRun(options: RunOptions): Promise<void> {
  const repository = createRepository();
  const configService = createConfigService(createOverrides(options));
  const location = await repository.detect(process.cwd());
  const configuration = await configService.getMerged(location?.rootPath);
  const liveUpdates = configuration.ui?.liveUpdates !== false;

  const useCase = new RunWorkflowUseCase({
    repository,
    configService,
    instructionLoader: createInstructionLoader(),
    templateLoader: createTemplateLoader(),
    plannerFactory: createModelResolver(),
    approval: createApproval(options),
    progress: createProgress(liveUpdates),
    planPersistence: createPlanPersistence(),
    statePersistence: createStatePersistence(),
  });

  const result = await useCase.execute({
    cwd: process.cwd(),
    dryRun: options.dryRun === true,
    resume: options.resume === true,
  });

  if (result.status === 'no-changes') {
    console.log('No changes to work with.');
    return;
  }

  if (result.plan !== undefined) {
    new PlanView().display(result.plan, result.provider, result.modelId);
  }

  if (result.status === 'planned') {
    console.log('Dry run: no changes were made.');
    return;
  }

  new ResultView().display(result);

  if (result.status === 'failed') {
    process.exitCode = ExitCode.WorkflowFailed;
  }
}

function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function createApproval(options: RunOptions): ApprovalPort {
  if (options.yes === true) {
    return new AutoApproval();
  }
  return isInteractive() ? new ClackApproval() : new NonInteractiveApproval();
}

function createProgress(liveUpdates: boolean): ProgressReporter {
  return isInteractive() && liveUpdates ? new ClackProgressReporter() : new NullProgressReporter();
}

function createOverrides(options: RunOptions): ConfigurationPatch | undefined {
  if (options.provider === undefined && options.model === undefined) {
    return undefined;
  }

  return {
    ai: {
      ...(options.provider !== undefined ? { provider: options.provider } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
    },
  };
}

export function runCommand(): Command {
  const command = new Command('run');
  command
    .description('Run the default workflow')
    .option('--dry-run', 'Show the plan without changing the repository')
    .option('-y, --yes', 'Approve all operations without prompting')
    .option('-r, --resume', 'Resume from a previously saved plan')
    .option('--provider <name>', 'Override the AI provider for this run')
    .option('--model <id>', 'Override the AI model for this run')
    .action(async (options: RunOptions) => {
      await executeRun(options);
    });

  return command;
}