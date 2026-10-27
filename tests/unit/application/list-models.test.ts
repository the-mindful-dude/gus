import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ListModelsUseCase } from '../../../src/application/use-cases/list-models.use-case';
import { ConfigService } from '../../../src/infrastructure/config/config-service';

class TestProviderCatalog {
  constructor(private providers: string[] = ['openai']) {}

  list(): string[] {
    return this.providers;
  }

  has(name: string): boolean {
    return this.providers.includes(name);
  }
}

describe('ListModelsUseCase', () => {
  let globalDir: string;
  let repoRoot: string;

  beforeEach(async () => {
    globalDir = await mkdtemp(join(tmpdir(), 'gus-global-'));
    repoRoot = await mkdtemp(join(tmpdir(), 'gus-repo-'));
  });

  afterEach(async () => {
    await rm(globalDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('returns project configuration overriding global configuration', async () => {
    const configService = new ConfigService({ globalDir });
    await configService.write('global', { ai: { model: 'gpt-4o' } });
    await mkdir(join(repoRoot, '.gus'), { recursive: true });
    await writeFile(
      join(repoRoot, '.gus', 'config.json'),
      JSON.stringify({ ai: { model: 'gpt-4o-mini' } }),
      'utf-8',
    );

    const useCase = new ListModelsUseCase(configService, new TestProviderCatalog());
    const result = await useCase.list(repoRoot);

    expect(result.configured.modelId).toBe('gpt-4o-mini');
    expect(result.configured.source).toBe('project');
  });
});
