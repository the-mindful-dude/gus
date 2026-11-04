import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModelV1 } from 'ai';
import type { AiPlanner } from '../../application/ports/ai-planner.port.js';
import type { AiProvider, CreatePlannerOptions } from './ai-provider-registry.js';
import { AiSdkPlannerAdapter } from './ai-sdk-planner.adapter.js';

export interface GoogleProviderOptions {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  temperature?: number;
  maxRetries?: number;
}

export class GoogleProvider implements AiProvider {
  readonly name = 'google';
  readonly defaultModel: string;
  private readonly client: ReturnType<typeof createGoogleGenerativeAI>;
  private readonly temperature?: number;
  private readonly maxRetries?: number;

  constructor(options: GoogleProviderOptions = {}) {
    this.defaultModel = options.defaultModel ?? 'gemini-1.5-flash';
    this.temperature = options.temperature;
    this.maxRetries = options.maxRetries;
    this.client = createGoogleGenerativeAI({ apiKey: options.apiKey, baseURL: options.baseURL });
  }

  createModel(modelId?: string): LanguageModelV1 {
    return this.client(modelId ?? this.defaultModel) as unknown as LanguageModelV1;
  }

  createPlanner(options: CreatePlannerOptions = {}): AiPlanner {
    return new AiSdkPlannerAdapter({
      model: this.createModel(options.modelId),
      temperature: options.temperature ?? this.temperature,
      maxRetries: this.maxRetries,
    });
  }
}
