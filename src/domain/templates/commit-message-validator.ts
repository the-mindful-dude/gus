import type { CommitTemplate } from './commit-template.js';

const PLACEHOLDER_PATTERN = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const SUBJECT_LIMIT_PATTERN = /(\d+)\s*(?:characters?|chars?)/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstMeaningfulLine(templateBlock: string): string | null {
  for (const line of templateBlock.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

function placeholderPattern(name: string): string {
  return name === 'scope_suffix' ? '(?:\\([^)]*\\))?' : '.+?';
}

export function templateSubjectPattern(templateBlock: string): RegExp | null {
  const line = firstMeaningfulLine(templateBlock);
  if (line === null) {
    return null;
  }

  const placeholderRegex = new RegExp(PLACEHOLDER_PATTERN.source, 'g');
  let pattern = '';
  let lastIndex = 0;
  let found = false;
  let match: RegExpExecArray | null = placeholderRegex.exec(line);
  while (match !== null) {
    found = true;
    pattern += escapeRegex(line.slice(lastIndex, match.index));
    pattern += placeholderPattern(match[1]);
    lastIndex = match.index + match[0].length;
    match = placeholderRegex.exec(line);
  }

  if (!found) {
    return null;
  }

  pattern += escapeRegex(line.slice(lastIndex));
  return new RegExp(`^${pattern}$`);
}

export function templateSubjectLimit(template: CommitTemplate): number | null {
  const match = template.rules.join(' ').match(SUBJECT_LIMIT_PATTERN);
  if (match === null) {
    return null;
  }

  const limit = Number(match[1]);
  return Number.isFinite(limit) && limit > 0 ? limit : null;
}

export function validateCommitMessage(message: string, template: CommitTemplate): string[] {
  const errors: string[] = [];
  const subject = message.split('\n', 1)[0].trim();

  if (subject.length === 0) {
    return ['Commit message must not be empty.'];
  }

  const pattern = templateSubjectPattern(template.templateBlock);
  if (pattern !== null && !pattern.test(subject)) {
    const shape = firstMeaningfulLine(template.templateBlock) ?? '';
    errors.push(`Commit subject "${subject}" does not match the template "${shape}".`);
  }

  const limit = templateSubjectLimit(template);
  if (limit !== null && subject.length > limit) {
    errors.push(
      `Commit subject "${subject}" is ${subject.length} characters; the template allows ${limit}.`,
    );
  }

  return errors;
}
