import { describe, expect, it } from 'vitest';
import type { CommitTemplate } from '../../../../src/domain/templates/commit-template';
import {
  renderTemplate,
  validateTemplate,
} from '../../../../src/infrastructure/templates/template-validator';

function template(templateBlock: string, placeholders: string[]): CommitTemplate {
  return {
    raw: '',
    templateBlock,
    rules: [],
    placeholders,
  };
}

const FULL_TEMPLATE = template('{{type}}{{scope_suffix}}: {{summary}}\n\n{{body}}\n\n{{footer}}', [
  'type',
  'scope_suffix',
  'summary',
  'body',
  'footer',
]);

describe('renderTemplate', () => {
  it('renders every supported placeholder', () => {
    expect(
      renderTemplate(FULL_TEMPLATE, {
        type: 'feat',
        scope: 'core',
        summary: 'add workflow planning',
        body: 'Explain the reason.',
        footer: 'Refs: #12',
      }),
    ).toBe('feat(core): add workflow planning\n\nExplain the reason.\n\nRefs: #12');
  });

  it('omits the scope suffix when no scope is provided', () => {
    expect(
      renderTemplate(FULL_TEMPLATE, {
        type: 'fix',
        summary: 'handle empty input',
      }),
    ).toBe('fix: handle empty input');
  });

  it('removes unintended empty lines when optional fields are absent', () => {
    expect(
      renderTemplate(
        template('{{type}}: {{summary}}\n\n{{body}}\n\n{{footer}}', [
          'type',
          'summary',
          'body',
          'footer',
        ]),
        {
          type: 'docs',
          summary: 'describe templates',
        },
      ),
    ).toBe('docs: describe templates');
  });

  it('keeps the body when the footer is absent', () => {
    expect(
      renderTemplate(FULL_TEMPLATE, {
        type: 'fix',
        summary: 'repair loader',
        body: 'The parser now validates placeholders.',
      }),
    ).toBe('fix: repair loader\n\nThe parser now validates placeholders.');
  });

  it('keeps the footer when the body is absent', () => {
    expect(
      renderTemplate(FULL_TEMPLATE, {
        type: 'chore',
        summary: 'update metadata',
        footer: 'Refs: #9',
      }),
    ).toBe('chore: update metadata\n\nRefs: #9');
  });

  it('leaves unsupported placeholders untouched', () => {
    expect(
      renderTemplate(template('{{type}}: {{summary}} {{ticket}}', ['type', 'summary', 'ticket']), {
        type: 'feat',
        summary: 'add feature',
      }),
    ).toBe('feat: add feature {{ticket}}');
  });
});

describe('validateTemplate', () => {
  it('accepts a template when the required summary is present', () => {
    expect(validateTemplate(FULL_TEMPLATE, { summary: 'add feature' })).toBe(true);
  });

  it('rejects a missing summary value', () => {
    expect(validateTemplate(FULL_TEMPLATE, { summary: '   ' })).toBe(false);
  });

  it('rejects templates containing unsupported placeholders', () => {
    expect(
      validateTemplate(
        template('{{type}}: {{summary}} {{ticket}}', ['type', 'summary', 'ticket']),
        {
          summary: 'add feature',
        },
      ),
    ).toBe(false);
  });

  it('rejects templates without the required summary placeholder', () => {
    expect(
      validateTemplate(template('{{type}}: {{body}}', ['type', 'body']), { summary: 'x' }),
    ).toBe(false);
  });
});
