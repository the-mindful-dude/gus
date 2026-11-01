import { describe, expect, it } from 'vitest';
import {
  templateSubjectLimit,
  templateSubjectPattern,
  validateCommitMessage,
} from '../../../../src/domain/templates/commit-message-validator';
import type { CommitTemplate } from '../../../../src/domain/templates/commit-template';

function template(): CommitTemplate {
  return {
    raw: '',
    templateBlock: '{{type}}{{scope_suffix}}: {{summary}}\n\n{{body}}',
    rules: ['- Keep the summary at or below 72 characters.'],
    placeholders: ['type', 'scope_suffix', 'summary', 'body'],
  };
}

describe('templateSubjectPattern', () => {
  it('builds a pattern from canonical placeholders', () => {
    const pattern = templateSubjectPattern('{{type}}{{scope_suffix}}: {{summary}}');

    expect(pattern?.test('feat(core): add workflow')).toBe(true);
    expect(pattern?.test('feat: add workflow')).toBe(true);
    expect(pattern?.test('add workflow')).toBe(false);
  });

  it('returns null when the subject line has no placeholders', () => {
    expect(templateSubjectPattern('chore: maintenance')).toBeNull();
  });
});

describe('templateSubjectLimit', () => {
  it('reads the limit from template rules', () => {
    expect(templateSubjectLimit(template())).toBe(72);
  });

  it('returns null when no limit is documented', () => {
    expect(templateSubjectLimit({ ...template(), rules: [] })).toBeNull();
  });
});

describe('validateCommitMessage', () => {
  it('accepts a message that follows the canonical template', () => {
    expect(validateCommitMessage('feat(core): add workflow', template())).toEqual([]);
  });

  it('accepts a message without an optional scope', () => {
    expect(validateCommitMessage('fix: handle empty input', template())).toEqual([]);
  });

  it('rejects a message that does not match the template shape', () => {
    expect(validateCommitMessage('update everything', template())).toEqual([
      'Commit subject "update everything" does not match the template "{{type}}{{scope_suffix}}: {{summary}}".',
    ]);
  });

  it('rejects a subject over the documented limit', () => {
    const errors = validateCommitMessage(`feat: ${'x'.repeat(80)}`, template());

    expect(errors.some((error) => error.includes('the template allows 72'))).toBe(true);
  });

  it('rejects an empty message', () => {
    expect(validateCommitMessage('   ', template())).toEqual(['Commit message must not be empty.']);
  });
});
