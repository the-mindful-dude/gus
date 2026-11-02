import { describe, expect, it } from 'vitest';
import { presentError, toExitCode } from '../../../src/cli/errors/error-mapper';
import {
  AiAuthenticationError,
  AiProviderError,
  ApprovalRequiredError,
  InsufficientContextError,
  InvalidAiResponseError,
  InvalidArgumentsError,
  InvalidConfigurationError,
  InvalidTemplateError,
  NoRepositoryError,
  OperationFailedError,
  PlanValidationError,
  UnsafeRepositoryStateError,
  VerificationError,
} from '../../../src/domain/errors/domain-errors';
import { ExitCode } from '../../../src/shared/exit-codes';

describe('error mapper', () => {
  it.each([
    [new InvalidArgumentsError('bad args'), ExitCode.InvalidInput],
    [new InvalidConfigurationError('bad config'), ExitCode.InvalidInput],
    [new InvalidTemplateError('bad template'), ExitCode.InvalidInput],
    [new NoRepositoryError('no repo'), ExitCode.RepositoryError],
    [new UnsafeRepositoryStateError('unsafe'), ExitCode.RepositoryError],
    [new AiAuthenticationError('no key'), ExitCode.AiError],
    [new AiProviderError('provider down'), ExitCode.AiError],
    [new InvalidAiResponseError('bad response'), ExitCode.AiError],
    [new ApprovalRequiredError('approval needed'), ExitCode.ApprovalRequired],
    [new OperationFailedError('commit failed'), ExitCode.WorkflowFailed],
    [new VerificationError('dirty'), ExitCode.WorkflowFailed],
    [new InsufficientContextError('too large'), ExitCode.WorkflowFailed],
  ])('maps %s to exit code %i', (error, expected) => {
    expect(toExitCode(error)).toBe(expected);
  });

  it('maps unknown errors to the internal error code', () => {
    expect(toExitCode(new Error('unexpected'))).toBe(ExitCode.InternalError);
  });

  it('includes plan validation errors in the next steps', () => {
    const presentation = presentError(
      new PlanValidationError('invalid plan', ['missing branch name', 'unknown path']),
    );

    expect(presentation.exitCode).toBe(ExitCode.WorkflowFailed);
    expect(presentation.title).toBe('Plan validation failed');
    expect(presentation.nextSteps).toContain('missing branch name');
    expect(presentation.nextSteps).toContain('unknown path');
  });
});
