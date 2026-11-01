import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvalidTemplateError } from '../../../../src/domain/errors/domain-errors';
import { TemplateLoader } from '../../../../src/infrastructure/templates/template-loader';

const CANONICAL_TEMPLATE = `# Commit Message Template

\`\`\`commit-template
{{type}}{{scope_suffix}}: {{summary}}

{{body}}

{{footer}}
\`\`\`

## Rules

- Keep the summary at or below 72 characters.
- Use the body to explain the reason for a non-obvious change.

## Examples

- feat(core): add workflow planning
`;

let root: string;
let globalDir: string;
let repoRoot: string;
let globalPath: string;
let projectPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'gus-templates-'));
  globalDir = join(root, 'global');
  repoRoot = join(root, 'repo');
  globalPath = join(globalDir, 'TEMPLATE.md');
  projectPath = join(repoRoot, '.gus', 'TEMPLATE.md');

  await mkdir(globalDir, { recursive: true });
  await mkdir(join(repoRoot, '.gus'), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('TemplateLoader', () => {
  it('returns null when no template exists', async () => {
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).resolves.toBeNull();
  });

  it('returns null when no repository root is provided and no global template exists', async () => {
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate()).resolves.toBeNull();
  });

  it('loads and parses a canonical project template', async () => {
    await writeFile(projectPath, CANONICAL_TEMPLATE, 'utf-8');
    const loader = new TemplateLoader(globalDir);

    const template = await loader.loadTemplate(repoRoot);

    expect(template).not.toBeNull();
    expect(template?.templateBlock).toBe(
      '{{type}}{{scope_suffix}}: {{summary}}\n\n{{body}}\n\n{{footer}}',
    );
    expect(template?.placeholders).toEqual(['type', 'scope_suffix', 'summary', 'body', 'footer']);
    expect(template?.rules).toEqual([
      '- Keep the summary at or below 72 characters.',
      '- Use the body to explain the reason for a non-obvious change.',
    ]);
  });

  it('loads the global template when no project template exists', async () => {
    await writeFile(globalPath, CANONICAL_TEMPLATE, 'utf-8');
    const loader = new TemplateLoader(globalDir);

    const template = await loader.loadTemplate(repoRoot);

    expect(template?.raw).toBe(CANONICAL_TEMPLATE);
  });

  it('prefers the project template over the global template', async () => {
    await writeFile(globalPath, CANONICAL_TEMPLATE, 'utf-8');
    await writeFile(
      projectPath,
      '# Project\n\n```commit-template\n{{type}}: {{summary}}\n```\n',
      'utf-8',
    );
    const loader = new TemplateLoader(globalDir);

    const template = await loader.loadTemplate(repoRoot);

    expect(template?.templateBlock).toBe('{{type}}: {{summary}}');
  });

  it('handles CRLF line endings', async () => {
    const crlf = '# Template\r\n\r\n```commit-template\r\n{{type}}: {{summary}}\r\n```\r\n';
    await writeFile(projectPath, crlf, 'utf-8');
    const loader = new TemplateLoader(globalDir);

    const template = await loader.loadTemplate(repoRoot);

    expect(template?.templateBlock).toBe('{{type}}: {{summary}}');
    expect(template?.placeholders).toEqual(['type', 'summary']);
  });

  it('rejects a template without a commit-template block', async () => {
    await writeFile(projectPath, '# Commit Template\n\nUse conventional commits.\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toBeInstanceOf(InvalidTemplateError);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(projectPath);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/no ```commit-template/);
  });

  it('rejects an empty commit-template block', async () => {
    await writeFile(projectPath, '```commit-template\n```\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/block is empty/);
  });

  it('rejects an unclosed commit-template block', async () => {
    await writeFile(projectPath, '```commit-template\n{{type}}: {{summary}}\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/is not closed/);
  });

  it('rejects multiple commit-template blocks', async () => {
    await writeFile(
      projectPath,
      '```commit-template\n{{type}}: {{summary}}\n```\n\n```commit-template\n{{summary}}\n```\n',
      'utf-8',
    );
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/multiple ```commit-template/);
  });

  it('rejects unsupported placeholders with the supported list', async () => {
    await writeFile(
      projectPath,
      '```commit-template\n{{type}}: {{summary}}\n\n{{ticket}}\n```\n',
      'utf-8',
    );
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/unsupported placeholder/);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/\{\{ticket\}\}/);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/\{\{summary\}\}/);
  });

  it('rejects legacy angle-bracket placeholders with canonical examples', async () => {
    await writeFile(projectPath, '```commit-template\n<type>(<scope>): <summary>\n```\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/legacy placeholder syntax/);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/<type> -> \{\{type\}\}/);
  });

  it('rejects malformed placeholders', async () => {
    await writeFile(projectPath, '```commit-template\n{{type}}: {{summary\n```\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/unclosed or malformed/);
  });

  it('rejects an empty placeholder', async () => {
    await writeFile(projectPath, '```commit-template\n{{}}: {{summary}}\n```\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/malformed placeholder/);
  });

  it('requires the summary placeholder', async () => {
    await writeFile(projectPath, '```commit-template\n{{type}}: {{body}}\n```\n', 'utf-8');
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(
      /required placeholder \{\{summary\}\}/,
    );
  });

  it('reports an unreadable template file with its path', async () => {
    await mkdir(projectPath, { recursive: true });
    const loader = new TemplateLoader(globalDir);

    await expect(loader.loadTemplate(repoRoot)).rejects.toBeInstanceOf(InvalidTemplateError);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(projectPath);
    await expect(loader.loadTemplate(repoRoot)).rejects.toThrow(/Failed to read commit template/);
  });
});
