export type AutomationPolicy = 'allow' | 'ask' | 'deny';
export const AUTOMATION_POLICY_VALUES = ['allow', 'ask', 'deny'] as const;

export type ConfigColor = 'auto' | 'always' | 'never';
export const CONFIG_COLOR_VALUES = ['auto', 'always', 'never'] as const;

export interface Configuration {
  ai?: {
    provider?: string;
    model?: string;
    temperature?: number;
  };
  workflow?: {
    autoCommit?: AutomationPolicy;
    autoCreateBranch?: AutomationPolicy;
    autoStage?: AutomationPolicy;
    splitChanges?: AutomationPolicy;
    commitStyle?: string;
    defaultBranch?: string;
  };
  ui?: {
    liveUpdates?: boolean;
    color?: ConfigColor;
  };
}

export type ConfigScope = 'global' | 'project';
export type ConfigValueSource = 'default' | 'global' | 'project' | 'override';
export type ConfigurationSection = 'ai' | 'workflow' | 'ui';

export type ConfigurationPatch = {
  ai?: Partial<NonNullable<Configuration['ai']>>;
  workflow?: Partial<NonNullable<Configuration['workflow']>>;
  ui?: Partial<NonNullable<Configuration['ui']>>;
};

export type ConfigValueKind = 'string' | 'number' | 'boolean' | 'enum';

export interface ConfigKeyDefinition {
  section: ConfigurationSection;
  field: string;
  kind: ConfigValueKind;
  values?: readonly string[];
  min?: number;
  max?: number;
}

export const CONFIG_KEYS = {
  'ai.provider': { section: 'ai', field: 'provider', kind: 'string' },
  'ai.model': { section: 'ai', field: 'model', kind: 'string' },
  'ai.temperature': { section: 'ai', field: 'temperature', kind: 'number', min: 0, max: 2 },
  'workflow.autoCommit': {
    section: 'workflow',
    field: 'autoCommit',
    kind: 'enum',
    values: AUTOMATION_POLICY_VALUES,
  },
  'workflow.autoCreateBranch': {
    section: 'workflow',
    field: 'autoCreateBranch',
    kind: 'enum',
    values: AUTOMATION_POLICY_VALUES,
  },
  'workflow.autoStage': {
    section: 'workflow',
    field: 'autoStage',
    kind: 'enum',
    values: AUTOMATION_POLICY_VALUES,
  },
  'workflow.splitChanges': {
    section: 'workflow',
    field: 'splitChanges',
    kind: 'enum',
    values: AUTOMATION_POLICY_VALUES,
  },
  'workflow.commitStyle': { section: 'workflow', field: 'commitStyle', kind: 'string' },
  'workflow.defaultBranch': { section: 'workflow', field: 'defaultBranch', kind: 'string' },
  'ui.liveUpdates': { section: 'ui', field: 'liveUpdates', kind: 'boolean' },
  'ui.color': {
    section: 'ui',
    field: 'color',
    kind: 'enum',
    values: CONFIG_COLOR_VALUES,
  },
} as const satisfies Record<string, ConfigKeyDefinition>;

export type ConfigKey = keyof typeof CONFIG_KEYS;

export const CONFIG_KEY_LIST = Object.keys(CONFIG_KEYS) as ConfigKey[];

export interface ResolvedConfiguration {
  configuration: Configuration;
  sources: Partial<Record<ConfigKey, ConfigValueSource>>;
}

export const DEFAULT_CONFIGURATION: Configuration = {
  ai: { provider: 'openai', model: 'gpt-4o-mini' },
  workflow: {
    autoCommit: 'ask',
    autoCreateBranch: 'ask',
    autoStage: 'ask',
    splitChanges: 'ask',
  },
};

export function isConfigKey(value: string): value is ConfigKey {
  return Object.prototype.hasOwnProperty.call(CONFIG_KEYS, value);
}

export function splitConfigKey(key: ConfigKey): [ConfigurationSection, string] {
  const definition = CONFIG_KEYS[key];
  return [definition.section, definition.field];
}

export function configurationPath(key: ConfigKey): string[] {
  return key.split('.');
}

export function hasConfigurationValue(config: unknown, path: string[]): boolean {
  let current: unknown = config;

  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

export function getConfigurationValue(config: unknown, path: string[]): unknown {
  let current: unknown = config;

  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export type CoercionResult = { ok: true; value: unknown } | { ok: false; message: string };

export function describeConfigKey(key: ConfigKey): string {
  const definition = CONFIG_KEYS[key];

  if (definition.kind === 'enum') {
    return definition.values.join(', ');
  }
  if (definition.kind === 'boolean') {
    return 'true, false';
  }
  if (definition.kind === 'number') {
    return `a number between ${definition.min ?? '-infinity'} and ${definition.max ?? 'infinity'}`;
  }

  return 'a string';
}

export function coerceConfigValue(key: ConfigKey, rawValue: string): CoercionResult {
  const definition = CONFIG_KEYS[key];

  if (definition.kind === 'enum') {
    if ((definition.values as readonly string[]).includes(rawValue)) {
      return { ok: true, value: rawValue };
    }
    return {
      ok: false,
      message: `Invalid value "${rawValue}" for "${key}". Allowed values: ${describeConfigKey(key)}.`,
    };
  }

  if (definition.kind === 'boolean') {
    if (rawValue === 'true') {
      return { ok: true, value: true };
    }
    if (rawValue === 'false') {
      return { ok: true, value: false };
    }
    return {
      ok: false,
      message: `Invalid value "${rawValue}" for "${key}". Allowed values: true, false.`,
    };
  }

  if (definition.kind === 'number') {
    const value = Number(rawValue);
    const min = definition.min ?? Number.NEGATIVE_INFINITY;
    const max = definition.max ?? Number.POSITIVE_INFINITY;
    if (rawValue.trim() === '' || Number.isNaN(value) || value < min || value > max) {
      return {
        ok: false,
        message: `Invalid value "${rawValue}" for "${key}". Allowed values: ${describeConfigKey(key)}.`,
      };
    }
    return { ok: true, value };
  }

  if (rawValue.trim() === '') {
    return { ok: false, message: `Value for "${key}" must not be empty.` };
  }

  return { ok: true, value: rawValue };
}
