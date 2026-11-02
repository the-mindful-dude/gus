import { errorChain, toErrorMessage } from '../../shared/errors.js';
import { ExitCode, type ExitCodeValue } from '../../shared/exit-codes.js';

export interface ErrorPresentation {
  exitCode: ExitCodeValue;
  title: string;
  message: string;
  nextSteps: string[];
}

interface ErrorRule {
  names: string[];
  exitCode: ExitCodeValue;
  title: string;
  nextSteps: string[];
}

const DEFAULT_NEXT_STEPS = [
  'Re-run the command.',
  'If the problem persists, review the repository state and report the issue with the command output.',
];

const ERROR_RULES: ErrorRule[] = [
  {
    names: ['InvalidArgumentsError'],
    exitCode: ExitCode.InvalidInput,
    title: 'Invalid arguments',
    nextSteps: ['Check the command options and run the command again.'],
  },
  {
    names: ['InvalidConfigurationError'],
    exitCode: ExitCode.InvalidInput,
    title: 'Invalid configuration',
    nextSteps: ["Check the 'ai' and 'workflow' sections of your configuration file."],
  },
  {
    names: ['InvalidTemplateError'],
    exitCode: ExitCode.InvalidInput,
    title: 'Invalid commit template',
    nextSteps: [
      "Fix the commit template file, usually '.gus/TEMPLATE.md', using the documented {{name}} placeholders.",
      'The repository was not modified.',
    ],
  },
  {
    names: ['InvalidBranchNameError'],
    exitCode: ExitCode.InvalidInput,
    title: 'Invalid branch name',
    nextSteps: [
      'Pick a different branch name that follows Git naming rules.',
      'The repository was not modified.',
    ],
  },
  {
    names: ['NoRepositoryError'],
    exitCode: ExitCode.RepositoryError,
    title: 'No supported repository',
    nextSteps: ['Run this command inside a Git repository.'],
  },
  {
    names: ['UnsupportedRepositoryError'],
    exitCode: ExitCode.RepositoryError,
    title: 'Unsupported repository',
    nextSteps: ['Run this command in a repository type supported by Gus.'],
  },
  {
    names: ['UnsafeRepositoryStateError'],
    exitCode: ExitCode.RepositoryError,
    title: 'Unsafe repository state',
    nextSteps: [
      'Finish or abort the in-progress Git operation (merge, rebase, or cherry-pick), then try again.',
    ],
  },
  {
    names: ['RepositoryInspectionError'],
    exitCode: ExitCode.RepositoryError,
    title: 'Repository inspection failed',
    nextSteps: ['Check that the repository is readable and try again.'],
  },
  {
    names: ['AiAuthenticationError'],
    exitCode: ExitCode.AiError,
    title: 'AI authentication failed',
    nextSteps: ['Configure a valid API key for the configured AI provider and try again.'],
  },
  {
    names: ['AiTimeoutError'],
    exitCode: ExitCode.AiError,
    title: 'AI provider timed out',
    nextSteps: ['Try again, or configure a faster model in your configuration.'],
  },
  {
    names: ['AiProviderError'],
    exitCode: ExitCode.AiError,
    title: 'AI provider failed',
    nextSteps: ['Check the configured AI provider and network connection, then try again.'],
  },
  {
    names: ['InvalidAiResponseError'],
    exitCode: ExitCode.AiError,
    title: 'Invalid AI response',
    nextSteps: ['Try again, and clarify the workflow instructions if the problem persists.'],
  },
  {
    names: ['PlanValidationError'],
    exitCode: ExitCode.WorkflowFailed,
    title: 'Plan validation failed',
    nextSteps: ['Review the reported validation errors and try again.'],
  },
  {
    names: ['InsufficientContextError'],
    exitCode: ExitCode.WorkflowFailed,
    title: 'Insufficient change context',
    nextSteps: [
      'The repository was not modified.',
      'Review the changed files manually, or split the work into smaller steps.',
    ],
  },
  {
    names: ['PolicyDeniedError'],
    exitCode: ExitCode.ApprovalRequired,
    title: 'Operation denied by policy',
    nextSteps: [
      'Adjust the matching workflow policy in your configuration to permit this operation.',
    ],
  },
  {
    names: ['ApprovalRequiredError'],
    exitCode: ExitCode.ApprovalRequired,
    title: 'Approval required',
    nextSteps: [
      "Re-run in an interactive terminal, or configure the operation with 'allow' in your configuration.",
    ],
  },
  {
    names: ['OperationFailedError'],
    exitCode: ExitCode.WorkflowFailed,
    title: 'Workflow operation failed',
    nextSteps: ['Review the repository state, then try again.'],
  },
  {
    names: ['VerificationError'],
    exitCode: ExitCode.WorkflowFailed,
    title: 'Verification failed',
    nextSteps: ['Inspect the repository manually to confirm the resulting state.'],
  },
];

function findRule(error: unknown): ErrorRule | undefined {
  const chain = new Set(errorChain(error));
  return ERROR_RULES.find((rule) => rule.names.some((name) => chain.has(name)));
}

function validationErrors(error: unknown): string[] {
  if (typeof error !== 'object' || error === null) {
    return [];
  }
  const errors = (error as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.filter((entry): entry is string => typeof entry === 'string');
}

export function toExitCode(error: unknown): ExitCodeValue {
  return findRule(error)?.exitCode ?? ExitCode.InternalError;
}

export function presentError(error: unknown): ErrorPresentation {
  const rule = findRule(error);
  const message = toErrorMessage(error);

  if (!rule) {
    return {
      exitCode: ExitCode.InternalError,
      title: 'Unexpected error',
      message,
      nextSteps: [...DEFAULT_NEXT_STEPS],
    };
  }

  const nextSteps = rule.names.includes('PlanValidationError')
    ? [...validationErrors(error), ...rule.nextSteps]
    : [...rule.nextSteps];

  return {
    exitCode: rule.exitCode,
    title: rule.title,
    message,
    nextSteps,
  };
}
