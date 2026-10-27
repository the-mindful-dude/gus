import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManageConfigUseCase } from '../../../src/application/use-cases/manage-config.use-case';
import {
  InvalidArgumentsError,
  InvalidConfigurationError,
} from '../../../src/domain/errors/domain-errors';
import { ConfigService } from '../../../src/infrastructure/config/config-service';

describe('ManageConfigUseCase', () => {
  let globalDir: string;
  let repoRoot: string;
  let useCase: ManageConfigUseCase;

  beforeEach(async () => {
    globalDir = await mkdtemp(join(tmpdir(), 'gus-global-'));
    repoRoot = await mkdtemp(join(tmpdir(), 'gus-repo-'));
    useCase = new ManageConfigUseCase(new ConfigService({ globalDir }));
  });

  afterEach(async () => {
    await rm(globalDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('returns the effective value and its source', async () => {
    const result = await useCase.get('ai.model', repoRoot);

    expect(result.value).toBe('gpt-4o-mini');
    expect(result.source).toBe('default');
  });

  it('rejects unknown keys', async () => {
    await expect(useCase.get('ai.nope', repoRoot)).rejects.toBeInstanceOf(InvalidArgumentsError);
  });

  it('rejects keys that have no value anywhere', async () => {
    await expect(useCase.get('ai.temperature', repoRoot)).rejects.toBeInstanceOf(
      InvalidArgumentsError,
    );
  });

  it('returns project configuration overriding global configuration', async () => {
    const configService = new ConfigService({ globalDir });
    const caseWithService = new ManageConfigUseCase(configService);
    await configService.write('global', { ai: { model: 'gpt-4o' } });
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    await mkdir(join(repoRoot, '.gus'), { recursive: true });
    await writeFile(join(repoRoot, '.gus', 'config.json'), JSON.stringify({ ai: { model: 'gpt-4o-mini' } }), 'utf-8');

    const result = await caseWithService.get('ai.model', repoRoot);
    expect(result.value).toBe('gpt-4o-mini');
    expect(result.source).toBe('project');
  });

  it('coerces numbers, booleans, and enums when setting', async () => {
    const temperature = await useCase.set('ai.temperature', '0.5', { scope: 'project', repoRoot });
    const color = await useCase.set('ui.color', 'never', { scope: 'project', repoRoot });
    const liveUpdates = await useCase.set('ui.liveUpdates', 'true', {
      scope: 'project',
      repoRoot,
    });

    expect(temperature.value).toBe(0.5);
    expect(color.value).toBe('never');
    expect(liveUpdates.value).toBe(true);
    expect(temperature.path).toBe(join(repoRoot, '.gus', 'config.json'));
  });

  it('rejects values outside the allowed set', async () => {
    await expect(
      useCase.set('workflow.autoCommit', 'maybe', { scope: 'global' }),
    ).rejects.toBeInstanceOf(InvalidConfigurationError);
    await expect(useCase.set('ai.temperature', '5', { scope: 'global' })).rejects.toBeInstanceOf(
      InvalidConfigurationError,
    );
  });

  it('requires a repository root for project scope', async () => {
    await expect(useCase.set('ai.model', 'gpt-4o', { scope: 'project' })).rejects.toBeInstanceOf(
      InvalidArgumentsError,
    );
  });
});
