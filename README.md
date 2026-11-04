# Gus

AI-assisted repository workflow automation. Gus inspects your repository changes, proposes a
structured workflow plan, asks for approval according to your configuration, and performs only the
approved branch, staging, and commit operations.

Gus is not a coding agent. It manages repository workflows and never lets the AI execute commands.

## Requirements

- Node.js 20 or newer
- Git
- An API key for AI planning (e.g., `GOOGLE_API_KEY` for Google Gemini)

## Install

```bash
npm install -g gus
# or run without installing
npx gus
```

## Commands

```bash
# Run the default workflow
gus

# Preview the plan without changing the repository
gus --dry-run

# Approve every operation without prompting (useful in CI)
gus --yes

# Override the provider or model for one run
gus --provider google --model gemini-1.5-flash

# Inspect repository state
gus status

# Inspect and update configuration
gus config get ai.model
gus config set ai.model gpt-4o --global

# Show the configured provider and model
gus models

# Create project starter files in .gus/
gus init
```

The explicit `gus run` command accepts the same workflow options.

## Configuration

Gus reads configuration in this order, with later sources taking precedence:

1. Built-in defaults
2. Global configuration: `~/.config/gus/config.json`
3. Project configuration: `.gus/config.json` in the repository root
4. Per-run overrides such as `--provider` and `--model`

`gus config set` writes to the project configuration when run inside a repository, and to the global
configuration otherwise. Use `--global` or `--project` to choose explicitly.

Supported keys:

| Key | Values | Default |
| --- | --- | --- |
| `ai.provider` | provider name | `google` |
| `ai.model` | model identifier | `gemini-1.5-flash` |
| `ai.temperature` | number from 0 to 2 | unset |
| `workflow.autoCommit` | `allow`, `ask`, `deny` | `ask` |
| `workflow.autoCreateBranch` | `allow`, `ask`, `deny` | `ask` |
| `workflow.autoStage` | `allow`, `ask`, `deny` | `ask` |
| `workflow.splitChanges` | `allow`, `ask`, `deny` | `ask` |
| `workflow.commitStyle` | string | unset |
| `workflow.defaultBranch` | string | unset |
| `ui.liveUpdates` | `true`, `false` | unset |
| `ui.color` | `auto`, `always`, `never` | unset |

`ui.liveUpdates: false` disables live progress output. `ui.color` is accepted but reserved for a
future release; color output currently follows the terminal environment (`NO_COLOR`,
`FORCE_COLOR`).

Policy values:

- `allow`: perform the operation without prompting.
- `ask`: request approval before performing the operation.
- `deny`: do not perform the operation.

## Google Gemini Provider Setup

Gus defaults to the Google Gemini provider. To use Google Gemini, set the `GOOGLE_API_KEY` environment variable with your Google AI API key:

```bash
export GOOGLE_API_KEY=your-google-api-key
```

You can obtain an API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

The key is read from the environment variable at runtime and used for AI planning. If `GOOGLE_API_KEY` is not set and no other provider is configured, Gus will fail with an authentication error.

## Instructions and templates

- `~/.config/gus/GUS.md` and `.gus/GUS.md` provide workflow instructions. Project instructions are
  combined with global instructions.
- `.gus/TEMPLATE.md` overrides `~/.config/gus/TEMPLATE.md` for commit message formatting.
- `gus init` creates `.gus/GUS.md`, `.gus/TEMPLATE.md`, and `.gus/config.json` without overwriting
  existing files.

## Safety behavior

- All AI output is validated against a Zod schema and the inspected repository state before anything
  changes.
- Only explicitly planned paths are staged. If the repository already has staged work, Gus refuses to
  mix it into the workflow.
- Unsafe states such as an in-progress merge, rebase, or cherry-pick block execution.
- If the repository changes between planning and execution, the plan is rejected.
- Gus never pushes, rewrites history, or runs arbitrary commands.
- Failed operations are reported accurately, including any partial work that remains.

## Non-interactive use and exit codes

When an operation requires approval and no interactive terminal is available, Gus fails safely
instead of waiting. Pass `--yes` to approve operations automatically.

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Unexpected internal error |
| `2` | Invalid command-line input or configuration |
| `3` | No supported repository, or an unsafe repository state |
| `4` | AI provider, authentication, or response failure |
| `5` | Approval required, unavailable, or denied by policy |
| `6` | Workflow failed; the repository may be in a partial state |

## Development

```bash
npm install
npm run dev          # run the CLI from source
npm run build        # bundle to dist/
npm run test:run     # run the test suite once
npm run lint
npm run typecheck
```

Gus follows a layered architecture: `cli/` → `application/` → `domain/`, with `infrastructure/`
implementing ports defined by the application. See `MODEL.md` for the full design.
