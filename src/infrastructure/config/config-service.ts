import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ConfigurationService } from '../../application/ports/configuration.port.js';
import {
  CONFIG_KEY_LIST,
  type ConfigKey,
  type ConfigScope,
  type ConfigValueSource,
  type Configuration,
  type ConfigurationPatch,
  type ResolvedConfiguration,
  configurationPath,
  hasConfigurationValue,
} from '../../domain/config/configuration.js';
import {
  InvalidArgumentsError,
  InvalidConfigurationError,
} from '../../domain/errors/domain-errors.js';
import { ConfigLoader } from './config-loader.js';
import { mergeConfigurationPatch, mergeConfigurations } from './config-merger.js';
import { getGlobalConfigPath, getProjectConfigPath } from './config-paths.js';
import {
  ConfigurationSchema,
  DEFAULT_CONFIGURATION,
  formatConfigurationIssues,
} from './config.schema.js';

export interface ConfigServiceOptions {
  globalDir?: string;
  overrides?: ConfigurationPatch;
}

export class ConfigService implements ConfigurationService {
  private readonly loader: ConfigLoader;
  private readonly globalDir?: string;
  private readonly overrides?: ConfigurationPatch;

  constructor(options: ConfigServiceOptions = {}) {
    this.globalDir = options.globalDir;
    this.overrides = options.overrides;
    this.loader = new ConfigLoader(options.globalDir);
  }

  async getMerged(repoRoot?: string): Promise<Configuration> {
    const resolved = await this.getResolved(repoRoot);
    return resolved.configuration;
  }

  async getResolved(repoRoot?: string): Promise<ResolvedConfiguration> {
    const globalConfig = await this.loader.loadGlobal();
    const projectConfig = repoRoot !== undefined ? await this.loader.loadProject(repoRoot) : {};
    const merged = mergeConfigurations(DEFAULT_CONFIGURATION, globalConfig, projectConfig);
    const configuration = this.overrides ? mergeConfigurationPatch(merged, this.overrides) : merged;

    return {
      configuration,
      sources: this.resolveSources(globalConfig, projectConfig),
    };
  }

  async read(scope: ConfigScope, repoRoot?: string): Promise<Configuration> {
    if (scope === 'project') {
      if (repoRoot === undefined) {
        throw new InvalidArgumentsError('Project configuration requires a repository root.');
      }
      return this.loader.loadProject(repoRoot);
    }

    return this.loader.loadGlobal();
  }

  async write(
    scope: ConfigScope,
    patch: ConfigurationPatch,
    repoRoot?: string,
  ): Promise<Configuration> {
    const existing = await this.read(scope, repoRoot);
    const merged = mergeConfigurationPatch(existing, patch);
    const result = ConfigurationSchema.safeParse(merged);
    const path = this.getLocation(scope, repoRoot);

    if (!result.success) {
      throw new InvalidConfigurationError(
        `Invalid configuration for ${path}: ${formatConfigurationIssues(result.error)}`,
      );
    }

    await mkdir(dirname(path), { recursive: true });
    const tempPath = join(dirname(path), `.config.json.tmp.${randomUUID()}`);
    await writeFile(tempPath, `${JSON.stringify(result.data, null, 2)}\n`, 'utf-8');
    await rename(tempPath, path);

    return result.data;
  }

  getLocation(scope: ConfigScope, repoRoot?: string): string {
    if (scope === 'project') {
      if (repoRoot === undefined) {
        throw new InvalidArgumentsError('Project configuration requires a repository root.');
      }
      return getProjectConfigPath(repoRoot);
    }

    return getGlobalConfigPath(this.globalDir);
  }

  private resolveSources(
    globalConfig: Configuration,
    projectConfig: Configuration,
  ): Partial<Record<ConfigKey, ConfigValueSource>> {
    const sources: Partial<Record<ConfigKey, ConfigValueSource>> = {};

    for (const key of CONFIG_KEY_LIST) {
      const path = configurationPath(key);

      if (this.overrides && hasConfigurationValue(this.overrides, path)) {
        sources[key] = 'override';
      } else if (hasConfigurationValue(projectConfig, path)) {
        sources[key] = 'project';
      } else if (hasConfigurationValue(globalConfig, path)) {
        sources[key] = 'global';
      } else if (hasConfigurationValue(DEFAULT_CONFIGURATION, path)) {
        sources[key] = 'default';
      }
    }

    return sources;
  }
}
