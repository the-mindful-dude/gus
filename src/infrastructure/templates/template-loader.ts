import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TemplateLoaderPort } from '../../application/ports/template-loader.port.js';
import { InvalidTemplateError } from '../../domain/errors/domain-errors.js';
import {
  type CommitTemplate,
  REQUIRED_TEMPLATE_PLACEHOLDERS,
  TEMPLATE_PLACEHOLDERS,
  isTemplatePlaceholder,
} from '../../domain/templates/commit-template.js';

const BLOCK_MARKER_PATTERN = /```commit-template\b/g;
const BLOCK_PATTERN = /```commit-template[ \t]*\n([\s\S]*?)```/;
const PLACEHOLDER_TOKEN_PATTERN = /\{\{([^{}]*)\}\}/g;
const PLACEHOLDER_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const LEGACY_PLACEHOLDER_PATTERN = /<([a-z][a-z0-9_]*)>/g;

function supportedPlaceholders(): string {
  return TEMPLATE_PLACEHOLDERS.map((placeholder) => `{{${placeholder}}}`).join(', ');
}

function extractRules(raw: string): string[] {
  const match = raw.match(/^##\s+Rules\s*$/im);
  if (match?.index === undefined) {
    return [];
  }

  const section = raw.slice(match.index + match[0].length);
  const nextHeading = section.search(/^##\s+/m);
  const body = nextHeading === -1 ? section : section.slice(0, nextHeading);

  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'));
}

function malformed(path: string, reason: string): InvalidTemplateError {
  return new InvalidTemplateError(`Invalid commit template at ${path}: ${reason}`);
}

function parseTemplateBlock(path: string, raw: string): string {
  const markers = raw.match(BLOCK_MARKER_PATTERN) ?? [];
  if (markers.length === 0) {
    throw malformed(
      path,
      'no ```commit-template fenced block was found. Add a block such as:\n\n```commit-template\n{{type}}{{scope_suffix}}: {{summary}}\n```',
    );
  }

  if (markers.length > 1) {
    throw malformed(
      path,
      'multiple ```commit-template blocks were found. Keep exactly one so the message structure is unambiguous.',
    );
  }

  const match = raw.match(BLOCK_PATTERN);
  if (match === null) {
    throw malformed(
      path,
      'the ```commit-template block is not closed. Add a closing ``` fence after the message structure.',
    );
  }

  const templateBlock = match[1].trim();
  if (templateBlock.length === 0) {
    throw malformed(
      path,
      'the ```commit-template block is empty. Define the message structure inside the block.',
    );
  }

  return templateBlock;
}

function extractPlaceholders(path: string, templateBlock: string): string[] {
  const placeholders: string[] = [];

  for (const match of templateBlock.matchAll(PLACEHOLDER_TOKEN_PATTERN)) {
    const name = match[1];
    if (name.length === 0 || name !== name.trim() || !PLACEHOLDER_NAME_PATTERN.test(name)) {
      throw malformed(
        path,
        `malformed placeholder "${match[0]}". Placeholders must use the form {{name}} with lowercase letters, digits, and underscores.`,
      );
    }

    if (!isTemplatePlaceholder(name)) {
      throw malformed(
        path,
        `unsupported placeholder "${match[0]}". Supported placeholders are: ${supportedPlaceholders()}.`,
      );
    }

    if (!placeholders.includes(name)) {
      placeholders.push(name);
    }
  }

  const withoutPlaceholders = templateBlock.replace(PLACEHOLDER_TOKEN_PATTERN, '');
  if (withoutPlaceholders.includes('{{') || withoutPlaceholders.includes('}}')) {
    throw malformed(
      path,
      'an unclosed or malformed placeholder was found. Placeholders must use the form {{name}}.',
    );
  }

  const legacyPlaceholders = [...templateBlock.matchAll(LEGACY_PLACEHOLDER_PATTERN)]
    .map((match) => match[1])
    .filter((name) => isTemplatePlaceholder(name))
    .map((name) => `<${name}>`);

  if (legacyPlaceholders.length > 0) {
    const examples = [...new Set(legacyPlaceholders)]
      .map((placeholder) => `${placeholder} -> {{${placeholder.slice(1, -1)}}}`)
      .join(', ');
    throw malformed(
      path,
      `legacy placeholder syntax was found (${examples}). Use the canonical {{name}} syntax.`,
    );
  }

  const missing = REQUIRED_TEMPLATE_PLACEHOLDERS.filter(
    (placeholder) => !placeholders.includes(placeholder),
  );
  if (missing.length > 0) {
    const required = missing.map((placeholder) => `{{${placeholder}}}`).join(', ');
    throw malformed(
      path,
      `the \`\`\`commit-template block must include the required placeholder ${required}.`,
    );
  }

  return placeholders;
}

export class TemplateLoader implements TemplateLoaderPort {
  constructor(private globalDir?: string) {}

  async loadTemplate(repoRoot?: string): Promise<CommitTemplate | null> {
    if (repoRoot) {
      const projectPath = join(repoRoot, '.gus', 'TEMPLATE.md');
      if (existsSync(projectPath)) {
        return this.loadFromPath(projectPath);
      }
    }

    const globalPath = join(this.globalDir ?? join(homedir(), '.config', 'gus'), 'TEMPLATE.md');
    if (existsSync(globalPath)) {
      return this.loadFromPath(globalPath);
    }

    return null;
  }

  private async loadFromPath(path: string): Promise<CommitTemplate> {
    let raw: string;
    try {
      raw = await readFile(path, 'utf-8');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InvalidTemplateError(`Failed to read commit template ${path}: ${reason}`);
    }

    const normalized = raw.replace(/\r\n/g, '\n');
    const templateBlock = parseTemplateBlock(path, normalized);

    return {
      raw,
      templateBlock,
      rules: extractRules(normalized),
      placeholders: extractPlaceholders(path, templateBlock),
    };
  }
}
