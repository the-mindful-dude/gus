import { Command } from 'commander';
import { ManageConfigUseCase } from '../../application/use-cases/manage-config.use-case.js';
import type { ConfigScope } from '../../domain/config/configuration.js';
import { InvalidArgumentsError, NoRepositoryError } from '../../domain/errors/domain-errors.js';
import { createConfigService, createRepository } from '../composition.js';

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function resolveScope(
  explicit?: ConfigScope,
): Promise<{ scope: ConfigScope; repoRoot?: string }> {
  if (explicit === 'global') {
    return { scope: 'global' };
  }

  if (explicit === 'project') {
    const location = await createRepository().detect(process.cwd());
    if (location === null) {
      throw new NoRepositoryError('Project configuration requires a Git repository.');
    }
    return { scope: 'project', repoRoot: location.rootPath };
  }

  const location = await createRepository().detect(process.cwd());
  return location === null
    ? { scope: 'global' }
    : { scope: 'project', repoRoot: location.rootPath };
}

export function configCommand(): Command {
  const command = new Command('config');
  command.description('Inspect and update Gus configuration');

  command
    .command('get <key>')
    .description('Show the effective value of a configuration key')
    .action(async (key: string) => {
      const location = await createRepository().detect(process.cwd());
      const useCase = new ManageConfigUseCase(createConfigService());
      const result = await useCase.get(key, location?.rootPath);
      console.log(`${result.key} = ${formatValue(result.value)} (${result.source})`);
    });

  command
    .command('set <key> <value>')
    .description('Set a configuration value')
    .option('--global', 'Write to the global configuration')
    .option('--project', 'Write to the project configuration')
    .action(
      async (key: string, value: string, options: { global?: boolean; project?: boolean }) => {
        if (options.global === true && options.project === true) {
          throw new InvalidArgumentsError('Choose either --global or --project, not both.');
        }

        const explicit =
          options.global === true ? 'global' : options.project === true ? 'project' : undefined;
        const { scope, repoRoot } = await resolveScope(explicit);
        const useCase = new ManageConfigUseCase(createConfigService());
        const result = await useCase.set(key, value, { scope, repoRoot });

        console.log(`${result.key} = ${formatValue(result.value)}`);
        console.log(`Saved to ${result.path}`);
      },
    );

  return command;
}
