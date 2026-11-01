import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { DEFAULT_CONFIGURATION } from '../../domain/config/configuration.js';
import { NoRepositoryError } from '../../domain/errors/domain-errors.js';
import { createRepository } from '../composition.js';

const INSTRUCTIONS = `# Gus Instructions

## Workflow
- Prefer feature branches for new functionality.
- Keep commits focused and use conventional commit messages.
`;

const TEMPLATE = `# Commit Template

\`\`\`commit-template
{{type}}{{scope_suffix}}: {{summary}}

{{body}}

{{footer}}
\`\`\`

## Rules
- Use the imperative mood in the summary.
- Keep the summary at or below 72 characters.
- Explain the reason for the change in the body when it is not obvious.
`;

export function initCommand(): Command {
  const command = new Command('init');
  command.description('Create project-level starter files in .gus/');

  command.action(async () => {
    const repository = createRepository();
    const location = await repository.detect(process.cwd());
    if (location === null) {
      throw new NoRepositoryError('Run "gus init" inside a Git repository.');
    }

    const gusDir = join(location.rootPath, '.gus');
    await mkdir(gusDir, { recursive: true });

    const files: Array<{ name: string; content: string }> = [
      { name: 'GUS.md', content: INSTRUCTIONS },
      { name: 'TEMPLATE.md', content: TEMPLATE },
      {
        name: 'config.json',
        content: `${JSON.stringify(DEFAULT_CONFIGURATION, null, 2)}\n`,
      },
    ];

    for (const file of files) {
      const path = join(gusDir, file.name);
      if (existsSync(path)) {
        console.log(`Kept existing ${path}`);
        continue;
      }
      await writeFile(path, file.content, 'utf-8');
      console.log(`Created ${path}`);
    }
  });

  return command;
}
