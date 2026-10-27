import { Command } from 'commander';
import { ListModelsUseCase } from '../../application/use-cases/list-models.use-case.js';
import { createConfigService, createProviderRegistry, createRepository } from '../composition.js';

export function modelsCommand(): Command {
  const command = new Command('models');
  command.description('Show the configured AI provider and model');

  command.action(async () => {
    const location = await createRepository().detect(process.cwd());
    const useCase = new ListModelsUseCase(createConfigService(), createProviderRegistry());
    const result = await useCase.list(location?.rootPath);

    console.log(`Provider: ${result.configured.provider || '(not set)'}`);
    console.log(`Model: ${result.configured.modelId || '(not set)'} (${result.configured.source})`);

    if (result.supportedProviders.length > 0) {
      console.log(`Supported providers: ${result.supportedProviders.join(', ')}`);
    }

    for (const note of result.notes) {
      console.log(`Note: ${note}`);
    }
  });

  return command;
}
