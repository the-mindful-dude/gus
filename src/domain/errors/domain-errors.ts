export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class RepositoryError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class UnsafeRepositoryStateError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeRepositoryStateError';
  }
}

export class NoRepositoryError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = 'NoRepositoryError';
  }
}

export class InvalidArgumentsError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArgumentsError';
  }
}

export class InvalidConfigurationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigurationError';
  }
}

export class InvalidTemplateError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTemplateError';
  }
}

export class UnsupportedRepositoryError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedRepositoryError';
  }
}

export class RepositoryInspectionError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryInspectionError';
  }
}

export class AiProviderError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiAuthenticationError extends AiProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'AiAuthenticationError';
  }
}

export class AiTimeoutError extends AiProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

export class InvalidAiResponseError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiResponseError';
  }
}

export class PlanValidationError extends DomainError {
  readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

export class InsufficientContextError extends DomainError {
  readonly omittedPaths: string[];

  constructor(message: string, omittedPaths: string[] = []) {
    super(message);
    this.name = 'InsufficientContextError';
    this.omittedPaths = omittedPaths;
  }
}

export class PolicyDeniedError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyDeniedError';
  }
}

export class ApprovalRequiredError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

export class OperationFailedError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'OperationFailedError';
  }
}

export class VerificationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

export class InvalidBranchNameError extends DomainError {
  readonly branchName?: string;

  constructor(message: string, branchName?: string) {
    super(message);
    this.name = 'InvalidBranchNameError';
    this.branchName = branchName;
  }
}
