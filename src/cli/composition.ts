import type { ConfigurationPatch } from '../domain/config/configuration.js';
import { AiProviderRegistry } from '../infrastructure/ai/ai-provider-registry.js';
import { OpenAiProvider } from '../infrastructure/ai/ai-provider.openai.js';
import { ModelResolver } from '../infrastructure/ai/model-resolver.js';
import { ConfigService } from '../infrastructure/config/config-service.js';
import { MarkdownInstructionLoader } from '../infrastructure/instructions/markdown-instruction-loader.js';
import { ProcessRunner } from '../infrastructure/process/process-runner.js';
import { GitRepositoryAdapter } from '../infrastructure/repository/providers/git-cli/git-repository.adapter.js';
import { TemplateLoader } from '../infrastructure/templates/template-loader.js';

export function createRepository(): GitRepositoryAdapter {
  return new GitRepositoryAdapter(new ProcessRunner());
}

export function createConfigService(overrides?: ConfigurationPatch): ConfigService {
  return new ConfigService(overrides !== undefined ? { overrides } : {});
}

export function createInstructionLoader(): MarkdownInstructionLoader {
  return new MarkdownInstructionLoader();
}

export function createTemplateLoader(): TemplateLoader {
  return new TemplateLoader();
}

export function createProviderRegistry(): AiProviderRegistry {
  const registry = new AiProviderRegistry();
  registry.register(new OpenAiProvider());
  return registry;
}

export function createModelResolver(): ModelResolver {
  return new ModelResolver(createProviderRegistry());
}