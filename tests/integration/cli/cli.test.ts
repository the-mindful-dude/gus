import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const CLI_ENTRY = join(PROJECT_ROOT, 'src', 'cli', 'main.ts');
const TSX = join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx');

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

describe('CLI', () => {
  let homeDir: string;
  let repoDir: string;

  async function runCli(
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
  ): Promise<CliResult> {
    const baseEnv: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: homeDir,
      ...(options.env ?? {}),
    };
    const env = Object.fromEntries(
      Object.entries(baseEnv).filter(([key]) => key !== 'OPENAI_API_KEY'),
    );

    const result = await execa(TSX, [CLI_ENTRY, ...args], {
      cwd: options.cwd ?? repoDir,
      env,
      reject: false,
    });

    return {
      exitCode: result.exitCode ?? 1,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'gus-cli-home-'));
    repoDir = await mkdtemp(join(tmpdir(), 'gus-cli-repo-'));
    await execa('git', ['init'], { cwd: repoDir });
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it('prints help and version', async () => {
    const help = await runCli(['--help']);
    const version = await runCli(['--version']);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain('Commands:');
    expect(version.exitCode).toBe(0);
    expect(version.stdout.trim()).toBe('0.1.0');
  });

  it('returns a dedicated exit code for invalid input', async () => {
    const result = await runCli(['no-such-command']);

    expect(result.exitCode).toBe(2);
  });

  it('shows the configured model and its source', async () => {
    const result = await runCli(['models']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Provider: openai');
    expect(result.stdout).toContain('Model: gpt-4o-mini (default)');
  });

  it('shows project model overriding global in a repository', async () => {
    await runCli(['config', 'set', 'ai.model', 'gpt-4o', '--global']);
    await runCli(['config', 'set', 'ai.model', 'gpt-4o-mini']);
    const result = await runCli(['models']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Model: gpt-4o-mini (project)');
  });

  it('gets and sets global configuration', async () => {
    const set = await runCli(['config', 'set', 'ai.model', 'gpt-4o', '--global']);
    const get = await runCli(['config', 'get', 'ai.model']);
    const stored = await readFile(join(homeDir, '.config', 'gus', 'config.json'), 'utf-8');

    expect(set.exitCode).toBe(0);
    expect(set.stdout).toContain('Saved to');
    expect(get.stdout).toContain('ai.model = gpt-4o (global)');
    expect(JSON.parse(stored).ai.model).toBe('gpt-4o');
  });

  it('defaults configuration writes to the project when inside a repository', async () => {
    const result = await runCli(['config', 'set', 'workflow.autoCommit', 'allow']);
    const stored = await readFile(join(repoDir, '.gus', 'config.json'), 'utf-8');

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(stored).workflow.autoCommit).toBe('allow');
  });

  it('gets configuration with project overriding global in a repository', async () => {
    await runCli(['config', 'set', 'ai.model', 'gpt-4o', '--global']);
    await runCli(['config', 'set', 'ai.model', 'gpt-4o-mini']);
    const result = await runCli(['config', 'get', 'ai.model']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ai.model = gpt-4o-mini (project)');
  });

  it('rejects invalid configuration values', async () => {
    const result = await runCli(['config', 'set', 'workflow.autoCommit', 'maybe', '--global']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Allowed values');
  });

  it('shows repository status', async () => {
    await writeFile(join(repoDir, 'changed.txt'), 'hello', 'utf-8');
    const result = await runCli(['status']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Repository:');
    expect(result.stdout).toContain('changed.txt');
  });

  it('fails with a repository error outside a Git repository', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'gus-cli-outside-'));
    const result = await runCli(['status'], { cwd: outside });
    await rm(outside, { recursive: true, force: true });

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('No Git repository');
  });

  it('initializes starter files without overwriting them', async () => {
    const first = await runCli(['init']);
    const instructionsPath = join(repoDir, '.gus', 'GUS.md');
    await writeFile(instructionsPath, 'custom instructions', 'utf-8');
    const second = await runCli(['init']);
    const instructions = await readFile(instructionsPath, 'utf-8');

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('Kept existing');
    expect(instructions).toBe('custom instructions');
    await expect(readFile(join(repoDir, '.gus', 'TEMPLATE.md'), 'utf-8')).resolves.toContain(
      '{{type}}{{scope_suffix}}: {{summary}}',
    );
  });

  it('rejects an invalid commit template before planning', async () => {
    await writeFile(join(repoDir, 'changed.txt'), 'hello', 'utf-8');
    await mkdir(join(repoDir, '.gus'), { recursive: true });
    await writeFile(join(repoDir, '.gus', 'TEMPLATE.md'), '# Template\n\nNo block.\n', 'utf-8');

    const result = await runCli(['run']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Invalid commit template');
    expect(result.stderr).toContain('commit-template');
  });

  it('short-circuits the workflow when there are no changes', async () => {
    const result = await runCli(['run']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No changes to work with.');
  });

  it('reports AI authentication failures with a dedicated exit code', async () => {
    await writeFile(join(repoDir, 'changed.txt'), 'hello', 'utf-8');
    const result = await runCli(['run', '--dry-run']);

    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain('AI authentication failed');
    expect(result.stderr).toContain('OPENAI_API_KEY');
  });
});
