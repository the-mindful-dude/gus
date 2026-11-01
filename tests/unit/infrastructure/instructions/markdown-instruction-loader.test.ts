import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvalidConfigurationError } from '../../../../src/domain/errors/domain-errors';
import { MarkdownInstructionLoader } from '../../../../src/infrastructure/instructions/markdown-instruction-loader';

let root: string;
let globalDir: string;
let repoRoot: string;
let globalPath: string;
let projectPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'gus-instructions-'));
  globalDir = join(root, 'global');
  repoRoot = join(root, 'repo');
  globalPath = join(globalDir, 'GUS.md');
  projectPath = join(repoRoot, '.gus', 'GUS.md');

  await mkdir(globalDir, { recursive: true });
  await mkdir(join(repoRoot, '.gus'), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('MarkdownInstructionLoader', () => {
  it('returns empty instructions when no files exist', async () => {
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions(repoRoot);

    expect(result.globalInstructions).toBe('');
    expect(result.projectInstructions).toBe('');
    expect(result.combined).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('returns empty instructions when no repository root is provided', async () => {
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions();

    expect(result.globalInstructions).toBe('');
    expect(result.projectInstructions).toBe('');
    expect(result.combined).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('loads global instructions when only the global file exists', async () => {
    await writeFile(globalPath, '# Global\n\nUse conventional commits.', 'utf-8');
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions(repoRoot);

    expect(result.globalInstructions).toBe('# Global\n\nUse conventional commits.');
    expect(result.projectInstructions).toBe('');
    expect(result.combined).toBe('# Global\n\nUse conventional commits.');
    expect(result.sources).toEqual([globalPath]);
  });

  it('loads project instructions when only the project file exists', async () => {
    await writeFile(projectPath, '# Project\n\nKeep changes small.', 'utf-8');
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions(repoRoot);

    expect(result.globalInstructions).toBe('');
    expect(result.projectInstructions).toBe('# Project\n\nKeep changes small.');
    expect(result.combined).toBe('# Project\n\nKeep changes small.');
    expect(result.sources).toEqual([projectPath]);
  });

  it('combines global first and project second while preserving both sources', async () => {
    const globalInstructions = '# Global\n\nUse single quotes.';
    const projectInstructions = '# Project\n\nUse double quotes.';
    await writeFile(globalPath, globalInstructions, 'utf-8');
    await writeFile(projectPath, projectInstructions, 'utf-8');
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions(repoRoot);

    expect(result.globalInstructions).toBe(globalInstructions);
    expect(result.projectInstructions).toBe(projectInstructions);
    expect(result.combined).toBe(`${globalInstructions}\n\n---\n\n${projectInstructions}`);
    expect(result.sources).toEqual([globalPath, projectPath]);
  });

  it('treats empty files as empty instructions but still reports them as sources', async () => {
    await writeFile(globalPath, '', 'utf-8');
    await writeFile(projectPath, '', 'utf-8');
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions(repoRoot);

    expect(result.globalInstructions).toBe('');
    expect(result.projectInstructions).toBe('');
    expect(result.combined).toBe('');
    expect(result.sources).toEqual([globalPath, projectPath]);
  });

  it('omits empty or whitespace-only instructions from the combined output', async () => {
    const projectInstructions = '# Project\n\nKeep commits focused.';
    await writeFile(globalPath, '   \n\n', 'utf-8');
    await writeFile(projectPath, projectInstructions, 'utf-8');
    const loader = new MarkdownInstructionLoader(globalDir);

    const result = await loader.loadInstructions(repoRoot);

    expect(result.globalInstructions).toBe('   \n\n');
    expect(result.combined).toBe(projectInstructions);
    expect(result.sources).toEqual([globalPath, projectPath]);
  });

  it('throws a clear error identifying an unreadable global file', async () => {
    await mkdir(globalPath, { recursive: true });
    const loader = new MarkdownInstructionLoader(globalDir);

    await expect(loader.loadInstructions(repoRoot)).rejects.toBeInstanceOf(
      InvalidConfigurationError,
    );
    await expect(loader.loadInstructions(repoRoot)).rejects.toThrow(globalPath);
    await expect(loader.loadInstructions(repoRoot)).rejects.toThrow(
      /Failed to read global instructions file/,
    );
  });

  it('throws a clear error identifying an unreadable project file', async () => {
    await mkdir(projectPath, { recursive: true });
    const loader = new MarkdownInstructionLoader(globalDir);

    await expect(loader.loadInstructions(repoRoot)).rejects.toBeInstanceOf(
      InvalidConfigurationError,
    );
    await expect(loader.loadInstructions(repoRoot)).rejects.toThrow(projectPath);
    await expect(loader.loadInstructions(repoRoot)).rejects.toThrow(
      /Failed to read project instructions file/,
    );
  });
});
