import { describe, expect, it } from 'vitest';
import { WorkflowValidator } from '../../../src/application/services/workflow-validator.service';
import type { RepositorySnapshot } from '../../../src/domain/repository/repository-snapshot';
import type { CommitTemplate } from '../../../src/domain/templates/commit-template';
import type { WorkflowPlan } from '../../../src/domain/workflow/workflow-plan';

function snapshot(paths = ['a.ts', 'b.ts']): RepositorySnapshot {
  return {
    rootPath: '/repo',
    displayName: 'repo',
    currentBranch: 'main',
    isDetached: false,
    isOperationInProgress: false,
    changes: paths.map((path) => ({ path, status: 'modified', stagingState: 'unstaged' })),
    headSha: 'head-1',
    indexFingerprint: 'index-1',
    worktreeFingerprint: 'worktree-1',
  };
}

function plan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    summary: 'plan',
    branch: { strategy: 'current', reason: 'changes belong here' },
    commits: [{ message: 'feat: change', files: ['a.ts', 'b.ts'] }],
    warnings: [],
    ...overrides,
  };
}

describe('WorkflowValidator', () => {
  const validator = new WorkflowValidator();

  it('accepts a complete plan', () => {
    expect(validator.validate(plan(), snapshot())).toEqual({ valid: true, errors: [] });
  });

  it('rejects paths outside the change set', () => {
    const result = validator.validate(plan(), snapshot(['a.ts']));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Path not found in changes: b.ts');
  });

  it('rejects files assigned to multiple commits', () => {
    const result = validator.validate(
      plan({
        commits: [
          { message: 'one', files: ['a.ts'] },
          { message: 'two', files: ['a.ts', 'b.ts'] },
        ],
      }),
      snapshot(),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File assigned to multiple commits: a.ts');
  });

  it('rejects files repeated inside one commit', () => {
    const result = validator.validate(
      plan({ commits: [{ message: 'one', files: ['a.ts', 'a.ts'] }] }),
      snapshot(['a.ts']),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File appears more than once in commit "one": a.ts');
  });

  it('rejects unassigned changes', () => {
    const result = validator.validate(plan(), snapshot(['a.ts', 'b.ts', 'c.ts']));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Change not assigned to any commit: c.ts');
  });

  it('requires a valid branch name for a new branch', () => {
    const missing = validator.validate(
      plan({ branch: { strategy: 'new', reason: 'isolate' } }),
      snapshot(),
    );
    const invalid = validator.validate(
      plan({ branch: { strategy: 'new', name: 'bad name', reason: 'isolate' } }),
      snapshot(),
    );

    expect(missing.errors).toContain('Branch name is required when creating a new branch.');
    expect(invalid.errors.some((e) => e.startsWith('Invalid branch name: bad name'))).toBe(true);
  });

  describe('commit template validation', () => {
    const template: CommitTemplate = {
      raw: '',
      templateBlock: '{{type}}{{scope_suffix}}: {{summary}}',
      rules: ['- Keep the summary at or below 72 characters.'],
      placeholders: ['type', 'scope_suffix', 'summary'],
    };

    it('accepts messages that follow the template', () => {
      const result = validator.validate(
        plan({ commits: [{ message: 'feat(core): add workflow', files: ['a.ts', 'b.ts'] }] }),
        snapshot(),
        template,
      );

      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('rejects messages that do not follow the template shape', () => {
      const result = validator.validate(
        plan({ commits: [{ message: 'update everything', files: ['a.ts', 'b.ts'] }] }),
        snapshot(),
        template,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Commit subject "update everything" does not match the template "{{type}}{{scope_suffix}}: {{summary}}".',
      );
    });

    it('rejects subjects over the template limit', () => {
      const result = validator.validate(
        plan({
          commits: [{ message: `feat(core): ${'x'.repeat(80)}`, files: ['a.ts', 'b.ts'] }],
        }),
        snapshot(),
        template,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.includes('the template allows 72'))).toBe(true);
    });

    it('rejects empty commit groups', () => {
      const result = validator.validate(plan({ commits: [] }), snapshot(['a.ts', 'b.ts']));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Change not assigned to any commit: a.ts');
      expect(result.errors).toContain('Change not assigned to any commit: b.ts');
    });
  });
});
