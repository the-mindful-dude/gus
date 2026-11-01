import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  InstructionLoader,
  InstructionSet,
} from '../../application/ports/instruction-loader.port.js';
import { InvalidConfigurationError } from '../../domain/errors/domain-errors.js';

type InstructionScope = 'global' | 'project';

export class MarkdownInstructionLoader implements InstructionLoader {
  constructor(private globalDir?: string) {}

  async loadInstructions(repoRoot?: string): Promise<InstructionSet> {
    const sources: string[] = [];

    const globalPath = join(this.globalDir ?? join(homedir(), '.config', 'gus'), 'GUS.md');
    const globalInstructions = await this.readOptionalFile(globalPath, 'global');
    if (globalInstructions !== null) {
      sources.push(globalPath);
    }

    let projectInstructions = '';
    if (repoRoot) {
      const projectPath = join(repoRoot, '.gus', 'GUS.md');
      const loaded = await this.readOptionalFile(projectPath, 'project');
      if (loaded !== null) {
        projectInstructions = loaded;
        sources.push(projectPath);
      }
    }

    const combined = [globalInstructions ?? '', projectInstructions]
      .filter((s) => s.trim())
      .join('\n\n---\n\n');

    return {
      globalInstructions: globalInstructions ?? '',
      projectInstructions,
      combined,
      sources,
    };
  }

  private async readOptionalFile(path: string, scope: InstructionScope): Promise<string | null> {
    if (!existsSync(path)) {
      return null;
    }

    try {
      return await readFile(path, 'utf-8');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InvalidConfigurationError(
        `Failed to read ${scope} instructions file ${path}: ${reason}`,
      );
    }
  }
}
