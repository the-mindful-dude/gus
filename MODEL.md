# Gus — Product, Architecture, and Implementation Specification

## 1. Project Overview

Gus is an AI-assisted repository workflow automation tool designed to make everyday repository work easier, more consistent, and less manual.

The primary command is:

```
gus
```

Gus examines the current repository and its changes, determines an appropriate workflow, prepares a plan, and carries out approved repository operations. It helps decide whether changes belong on the current branch or a new branch, whether unrelated changes should become separate commits, and how commit messages should be written.

Gus is not a coding agent. Its primary responsibility is managing repository workflows, not generating application code, modifying features, or replacing general-purpose coding assistants.

The goal is to let a developer focus on writing code while Gus handles the repetitive decisions and operations involved in organizing, staging, and committing that work.

### Core capabilities

Gus should be able to:

- Inspect the current repository and understand its working state.
- Identify and classify changed, added, deleted, renamed, staged, and unstaged files.
- Analyze changes with an AI model and propose a suitable workflow.
- Decide whether to continue on the current branch or create a new branch.
- Group unrelated changes into separate commits when appropriate.
- Generate meaningful commit messages that follow configured conventions.
- Follow global and repository-specific instructions.
- Follow a user-defined commit message template when one exists.
- Execute operations according to the user's configured permissions.
- Display progress, loading states, decisions, and results directly in the terminal.
- Allow users to switch AI providers and models without changing the workflow implementation.
- Verify repository state after operations and stop safely when an operation cannot be completed reliably.

## 2. Product Principles

### 2.1 Keep the scope focused

Gus automates repository workflows. It does not need a general-purpose agent runtime, plugin marketplace, task management system, or independent orchestration framework.

Every feature should support the central workflow:

Inspect → Understand → Plan → Validate → Approve → Execute → Verify

### 2.2 AI makes recommendations; application logic controls execution

AI should understand the changes and propose a plan. It must not directly execute arbitrary commands or control repository operations.

The application validates the plan, checks configured policies, requests approval when necessary, and delegates approved actions to the repository provider.

An AI response is untrusted input until it passes schema validation and application-level checks.

### 2.3 Keep modules and services isolated

All modules and services must maintain clear boundaries. The CLI, AI integration, repository integration, configuration, instruction loading, workflow planning, policy evaluation, and execution logic must remain separate.

Do not introduce spaghetti code, circular dependencies, or shared modules that accumulate unrelated responsibilities.

Each module must have a clear purpose, an explicit public interface, and isolated implementation logic. A change to the AI provider should not require rewriting the CLI or repository workflow. A change to terminal presentation should not affect policy decisions. A new repository provider should not require rewriting the application workflow.

### 2.4 Design for future repository providers

Use repository as the general domain and application terminology.

The initial implementation may use a Git-backed repository, but Git-specific commands, output parsing, and internal details must remain inside the relevant infrastructure adapter. Application and domain logic must depend on a repository interface rather than issuing Git commands directly.

This boundary allows Gus to support different repository systems in the future without restructuring its core workflow.

### 2.5 Prefer a modular monolith

Gus should begin as one TypeScript application with clearly separated modules.

Do not introduce multiple deployable services, a monorepo, or separate packages for every module. Internal boundaries should be enforced through interfaces, dependency direction, and tests. Separate packages should only be introduced when a concrete requirement justifies them.

### 2.6 Make automation predictable

Automation settings should determine when Gus can act without asking. The user must be able to understand what Gus plans to do before an operation is executed.

An automatic permission is not permission to bypass validation, silently discard changes, or perform unsafe operations.

## 3. Primary Workflow

Running `gus` in a repository should trigger the main workflow.

### Step 1: Discover the repository

The application asks the repository-provider registry to identify a supported repository from the current working directory.

It should establish:

- Repository root.
- Current branch or equivalent reference, when supported.
- Repository state.
- Available repository capabilities.
- Whether the directory is a supported repository.
- Whether the repository is in a state that prevents safe automation.

If no supported repository is found, Gus should explain the problem and exit without modifying anything.

Repository discovery belongs to the repository subsystem. The CLI should not independently inspect repository-specific metadata.

### Step 2: Load configuration and instructions

Load the applicable machine-readable configuration, instruction files, and commit message template.

The configuration determines model selection, automation permissions, and other explicit settings.

`GUS.md` provides natural-language instructions and workflow preferences.

`TEMPLATE.md` defines the required structure and conventions for commit messages.

The application must resolve these inputs before requesting an AI-generated plan.

### Step 3: Inspect repository changes

The repository adapter collects a structured snapshot of the current state.

The snapshot should distinguish:

- Staged changes.
- Unstaged changes.
- Untracked files.
- Added, modified, deleted, and renamed files.
- Conflicting or otherwise unsafe changes.
- Current branch or equivalent repository reference.
- Relevant repository state flags.
- Relevant change metadata and diffs.

Gus should use this snapshot as the authoritative source for what exists in the repository. The AI must not be allowed to invent files, claim changes that do not exist, or infer repository state from assumptions.

If there are no relevant changes, Gus should provide a clear message and exit successfully without invoking the AI unnecessarily.

### Step 4: Prepare AI context

Construct a bounded, structured representation of the repository state.

Include only the information needed to make a workflow decision:

- Repository snapshot.
- Relevant diffs.
- Current branch and repository state.
- Global instructions.
- Project instructions.
- Applicable commit message template.
- Relevant workflow settings.

Do not send the entire repository to the model by default. Avoid reading unrelated files, unnecessary secrets, or large amounts of irrelevant content.

Large diffs should be bounded and handled deliberately. If important changes cannot be analyzed reliably, Gus should explain the limitation rather than pretending to understand them.

Repository content and diff text must be treated as data, not as instructions that can override Gus's system rules or application policies.

### Step 5: Generate a workflow plan

The AI planner should produce structured data describing the proposed operations.

The plan should include:

- The recommended branch strategy.
- A new branch name when required.
- The reasoning behind the workflow decision.
- One or more commit groups.
- The files assigned to each commit group.
- A commit message for each group.
- Any uncertainty or unresolved issues that require user review.

The model must not execute repository commands.

### Step 6: Validate the plan

Before any operation is performed, validate the plan against the repository snapshot, configuration, instructions, template, and application invariants.

Reject plans that contain invalid paths, unsupported operations, malformed messages, conflicting assignments, or any other violation of the workflow rules.

The validator must be deterministic and independent of the AI provider.

If the plan cannot be validated, Gus must stop before execution and report the specific reason.

### Step 7: Present the plan

Show the user a readable preview of the intended operations.

For example:

```
Repository: example-project
Current branch: main

Proposed workflow:
  Branch: create feature/user-profile

Commit 1:
  feat(profile): add profile data model
  Files: 2

Commit 2:
  test(profile): add profile validation tests
  Files: 3

Commit 3:
  docs(profile): document profile fields
  Files: 1

Actions:
  - Create branch
  - Stage the planned changes
  - Create 3 commits
  - Verify the final repository state
```

The actual output must reflect the validated plan. This example is illustrative, not a fixed workflow.

Apply the configured approval rules separately to branch creation, staging, and committing.

### Step 8: Execute the plan

The workflow executor coordinates the approved operations through the repository interface.

Operations should be carried out in a deliberate order. After each important operation, update the execution state and verify that the operation succeeded before proceeding.

If an operation fails, stop subsequent operations unless they are explicitly safe recovery or reporting steps.

Gus must report which operations succeeded, which failed, and whether any partial work remains.

### Step 9: Verify the final state

Inspect the repository again and compare the resulting state with the expected outcome.

Confirm that:

- The intended branch or reference is active.
- Expected commits were created.
- Commit messages match the required convention.
- Planned changes were handled as intended.
- Unexpected changes were not silently included.
- The repository is in a known state.

Print a final summary with the actual result.

## 4. Technology Stack

Use TypeScript and Node.js for the initial implementation.

Choose dependencies for specific responsibilities and avoid adding libraries without a clear purpose.

### Runtime and language

- TypeScript for static typing, explicit interfaces, and maintainable module boundaries.
- Node.js for runtime execution, filesystem access, configuration loading, and process management.
- ES modules for the module system.

Use a supported Node.js LTS release and declare the required runtime version in `package.json`.

### CLI command parsing

Use [`commander`](https://github.com/tj/commander.js?utm_source=chatgpt.com) for defining commands, arguments, options, help output, and CLI parsing.

Command definitions should remain thin. They should validate CLI inputs and invoke application use cases rather than implementing workflow logic directly.

### Terminal UI and live updates

Use [`@clack/prompts`](https://github.com/bombshell-dev/clack?utm_source=chatgpt.com) as the primary terminal interaction library.

It provides polished terminal prompts, confirmations, selection interfaces, progress indicators, and spinners whose messages can be updated while work is in progress.

Gus should use it to display meaningful workflow states such as:

```
◆ Detecting repository...
◆ Reading repository changes...
◆ Loading instructions...
◆ Analyzing changes with the selected model...
◆ Validating proposed workflow...
◆ Creating branch...
◆ Creating commit 1 of 3...
◆ Verifying final repository state...
```

These are example states. The terminal UI must reflect actual application events, not simulated progress.

Update spinner messages when meaningful events occur. Do not create decorative progress indicators that imply work is happening when nothing has changed.

Show interactive approval prompts only when the configured policy requires them and the terminal supports interaction.

In non-interactive environments, do not wait indefinitely for input. Apply the documented non-interactive behavior, fail safely when approval is required, and provide an actionable error.

Do not add a full-screen terminal framework to the MVP. Clack is sufficient for the planned command-driven interface. A more elaborate terminal UI should only be introduced when a concrete requirement demands one.

### AI integration

Use the [Vercel AI SDK](https://ai-sdk.dev/?utm_source=chatgpt.com) through the `ai` package.

The AI subsystem must provide a consistent interface for model calls and structured results. Provider-specific code must remain inside the AI infrastructure layer.

Start with one provider integration, such as `@ai-sdk/openai`. Support additional providers through explicit adapters or the SDK's unified model interface when needed.

Use schema-constrained structured output, validated with Zod, for workflow plans. Follow the installed stable version of the SDK rather than relying on outdated examples or experimental APIs without justification.

The AI layer must support:

- Provider selection.
- Model selection.
- Structured workflow-plan generation.
- Timeouts and cancellation where supported.
- Clear error handling.
- Relevant usage and diagnostic information.
- Consistent handling of invalid or incomplete AI responses.

Do not let AI provider-specific types leak into domain or application interfaces.

### Schema validation

Use [`zod`](https://github.com/colinhacks/zod?utm_source=chatgpt.com) for validating:

- Machine-readable configuration.
- AI-generated plans.
- Internal boundary inputs where runtime validation is appropriate.
- Parsed template metadata, if metadata is introduced.

TypeScript types alone are insufficient when values originate from configuration files, external processes, user input, or AI responses.

### Repository process execution

Use [`execa`](https://github.com/sindresorhus/execa?utm_source=chatgpt.com) for subprocess execution where appropriate, or a narrowly defined wrapper around Node.js process APIs.

The process runner must accept an executable and an argument array. It must not build shell commands by interpolating user-controlled or AI-generated strings.

Keep subprocess management inside infrastructure. Application services must use the repository interface rather than calling `execa` directly.

### Configuration and filesystem access

Use Node.js filesystem and path APIs for configuration files, Markdown instructions, and template loading. Implement the small amount of path resolution and configuration merging Gus needs directly unless a clear requirement justifies another dependency.

Use `node:os` to resolve the user's home directory. Do not hard-code absolute home-directory paths.

### Testing and code quality

Use:

- [`vitest`](https://vitest.dev/?utm_source=chatgpt.com) for unit and integration tests.
- [`tsup`](https://github.com/egoist/tsup?utm_source=chatgpt.com) for bundling the TypeScript CLI.
- [`Biome`](https://biomejs.dev/?utm_source=chatgpt.com) for formatting and linting.
- TypeScript strict mode for compiler-level checks.

Pin and maintain dependencies through the package manager lockfile. Use current stable compatible versions when implementing the project.

### Initial dependency set

Runtime dependencies:

```
ai
@ai-sdk/openai
commander
@clack/prompts
execa
zod
```

Development dependencies:

```
typescript
@types/node
tsx
tsup
vitest
@biomejs/biome
```

The list should remain small. Add provider packages, libraries, or tools only when an implemented feature requires them.

## 5. Repository Structure

Use a single application with explicit layers and module boundaries.

The following structure is the intended starting point:

```
gus/
├── src/
│   ├── cli/
│   │   ├── main.ts
│   │   ├── program.ts
│   │   ├── commands/
│   │   │   ├── run.command.ts
│   │   │   ├── status.command.ts
│   │   │   ├── config.command.ts
│   │   │   ├── models.command.ts
│   │   │   └── init.command.ts
│   │   └── ui/
│   │       ├── progress.ts
│   │       ├── prompts.ts
│   │       ├── plan-view.ts
│   │       └── result-view.ts
│   │
│   ├── application/
│   │   ├── ports/
│   │   │   ├── repository.port.ts
│   │   │   ├── ai-planner.port.ts
│   │   │   ├── configuration.port.ts
│   │   │   └── instruction-loader.port.ts
│   │   ├── use-cases/
│   │   │   ├── run-workflow.use-case.ts
│   │   │   ├── inspect-repository.use-case.ts
│   │   │   ├── show-status.use-case.ts
│   │   │   ├── manage-config.use-case.ts
│   │   │   └── list-models.use-case.ts
│   │   └── services/
│   │       ├── workflow-planner.service.ts
│   │       ├── workflow-validator.service.ts
│   │       └── workflow-executor.service.ts
│   │
│   ├── domain/
│   │   ├── repository/
│   │   │   ├── repository-snapshot.ts
│   │   │   ├── repository-change.ts
│   │   │   └── repository-capabilities.ts
│   │   ├── workflow/
│   │   │   ├── workflow-plan.ts
│   │   │   ├── commit-group.ts
│   │   │   ├── branch-strategy.ts
│   │   │   └── workflow-decision.ts
│   │   ├── policy/
│   │   │   ├── policy-rules.ts
│   │   │   └── policy-evaluator.ts
│   │   ├── instructions/
│   │   │   └── instruction-set.ts
│   │   ├── templates/
│   │   │   ├── commit-template.ts
│   │   │   └── template-renderer.ts
│   │   └── errors/
│   │       └── domain-errors.ts
│   │
│   ├── infrastructure/
│   │   ├── repository/
│   │   │   ├── repository-provider-registry.ts
│   │   │   └── providers/
│   │   │       └── git-cli/
│   │   │           ├── git-repository.adapter.ts
│   │   │           ├── git-command-runner.ts
│   │   │           ├── status-parser.ts
│   │   │           └── change-content.ts
│   │   │
│   │   ├── ai/
│   │   │   ├── ai-provider-registry.ts
│   │   │   ├── model-resolver.ts
│   │   │   ├── ai-sdk-planner.adapter.ts
│   │   │   ├── prompts/
│   │   │   │   └── workflow-planning.prompt.ts
│   │   │   └── schemas/
│   │   │       └── workflow-plan.schema.ts
│   │   │
│   │   ├── config/
│   │   │   ├── config-loader.ts
│   │   │   ├── config-merger.ts
│   │   │   ├── config-paths.ts
│   │   │   └── config.schema.ts
│   │   │
│   │   ├── instructions/
│   │   │   ├── markdown-instruction-loader.ts
│   │   │   └── instruction-merger.ts
│   │   │
│   │   ├── templates/
│   │   │   ├── template-loader.ts
│   │   │   └── template-validator.ts
│   │   │
│   │   ├── process/
│   │   │   └── process-runner.ts
│   │   │
│   │   └── filesystem/
│   │       └── file-reader.ts
│   │
│   ├── shared/
│   │   ├── result.ts
│   │   ├── logger.ts
│   │   └── errors.ts
│   │
│   └── index.ts
│
├── tests/
│   ├── unit/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── integration/
│   │   ├── repository/
│   │   ├── workflow/
│   │   └── config/
│   ├── fixtures/
│   └── helpers/
│
├── .gus/
│   ├── GUS.md
│   └── TEMPLATE.md
│
├── .gitignore
├── biome.json
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── LICENSE
└── CHANGELOG.md
```

The `.gus/GUS.md` and `.gus/TEMPLATE.md` entries above are examples of optional files used by a project adopting Gus. They are not application source files and must not be bundled as if they were part of the CLI implementation.

This structure establishes clear boundaries from the beginning. Create files when their corresponding responsibilities are implemented; avoid adding empty abstractions or unnecessary layers just to match the tree.

### Layer responsibilities

#### `cli/`

Responsible for parsing commands, reading command-line options, invoking use cases, and presenting progress and results.

It must not contain repository business logic, AI prompts, policy decisions, or direct process execution.

#### `application/`

Coordinates use cases and implements the execution sequence.

It depends on domain logic and explicitly defined ports. It decides which service to call and when, but delegates specialized work to the appropriate interface.

#### `domain/`

Contains core models, business rules, workflow decisions, policy semantics, template rules, and validation that does not require an external service.

The domain must not import Commander, Clack, the Vercel AI SDK, filesystem implementations, or subprocess libraries.

#### `infrastructure/`

Implements external integrations: repository providers, AI providers, configuration files, Markdown loading, templates, filesystem access, and process execution.

Infrastructure modules implement interfaces defined at the appropriate boundary. They must not contain unrelated workflow orchestration.

#### `shared/`

Contains only genuinely reusable, low-level utilities and common error or result types.

Do not use `shared/` as a dumping ground for unrelated functionality. Domain types and domain rules should stay in `domain/`.

## 6. Dependency Direction and Module Boundaries

Enforce the following dependency direction:

```
CLI
 |
 v
Application
 |
 v
Domain

Infrastructure implements the ports required by Application.
CLI and Application receive infrastructure implementations through composition.
```

More precisely:

- `cli` may depend on `application` and terminal UI utilities.
- `application` may depend on `domain` and application ports.
- `domain` must not depend on `application`, `cli`, or `infrastructure`.
- `infrastructure` may depend on application ports and domain contracts.
- `shared` must not depend on higher-level modules.
- No module should import another module's private implementation files.
- Avoid circular dependencies.
- Do not create a global service container or mutable singleton that hides dependencies.

Use explicit constructor or function dependencies. Application use cases should receive the repository adapter, AI planner, configuration service, instruction loader, and other required collaborators through their dependencies.

The composition root should create the concrete implementations and wire them together. This should primarily happen in `cli/main.ts` or a dedicated composition module.

Do not allow repository commands, AI calls, and user prompts to spread throughout the codebase. Each should pass through its designated boundary.

## 7. Core Contracts

The following contracts describe the intended design. They are conceptual TypeScript interfaces; refine the exact names and fields during implementation without weakening the boundaries.

### 7.1 Repository interface

The application depends on an interface similar to:

```
interface RepositoryAdapter {
  detect(cwd: string): Promise<RepositoryLocation | null>;

  getCapabilities(): Promise<RepositoryCapabilities>;

  inspect(): Promise<RepositorySnapshot>;

  createBranch(name: string): Promise<void>;

  checkoutBranch(name: string): Promise<void>;

  stagePaths(paths: string[]): Promise<void>;

  commit(message: string): Promise<CommitResult>;

  verify(): Promise<RepositorySnapshot>;
}
```

The final contract may separate read and write operations or introduce a capability-specific interface when useful.

The important requirement is that the application does not know which repository implementation executes these methods.

The initial adapter will communicate with a Git-backed repository through its native CLI. All command construction, process handling, output parsing, and repository-specific edge cases belong inside that adapter and its internal helpers.

The adapter must:

- Parse machine-readable output where available instead of relying on fragile human-readable output.
- Handle paths containing spaces and unusual characters safely.
- Distinguish ordinary failures from unsafe repository states.
- Avoid shell interpolation.
- Verify results of write operations.
- Report unsupported operations through explicit errors or capabilities.

### 7.2 Repository snapshot

The snapshot must contain sufficient information for planning and safe execution.

Conceptually:

```
interface RepositorySnapshot {
  rootPath: string;
  displayName: string;
  currentBranch: string | null;
  isDetached: boolean;
  isOperationInProgress: boolean;
  changes: RepositoryChange[];
}
```

`RepositoryChange` should represent a change independently of terminal output or AI phrasing.

It should capture the relevant path information, change status, staging state, rename information where applicable, and metadata needed to retrieve the relevant diff.

Do not use shell-formatted status text as the domain model.

### 7.3 AI planner interface

The AI planner receives prepared context and returns a structured workflow proposal.

```
interface AiPlanner {
  plan(input: WorkflowPlanningInput): Promise<WorkflowPlan>;
}
```

The planner must not receive a repository adapter with write capabilities. It should not be able to execute commits or mutate repository state.

It may explain uncertainty or recommend that the workflow be reviewed manually.

### 7.4 Workflow plan

A workflow plan should describe decisions rather than contain arbitrary executable commands.

Conceptually:

```
interface WorkflowPlan {
  summary: string;

  branch: {
    strategy: "current" | "new";
    name?: string;
    reason: string;
  };

  commits: CommitGroup[];

  warnings: string[];
}
```

Each commit group should contain:

- A proposed commit message.
- The paths assigned to that commit.
- A short explanation of the group.
- Any validation-relevant metadata.

Add explicit planning outcomes for no-op or manual-review cases if needed. Do not represent these as malformed plans or hide them in arbitrary strings.

For the initial release, one file should belong to at most one commit group. Gus must not attempt hunk-level splitting or silently discard changes it cannot assign safely.

### 7.5 Workflow executor

The executor receives a validated plan and the user's effective policies.

It coordinates operations using the repository adapter, reports completed steps, and verifies the resulting state.

It must not:

- Construct AI prompts.
- Parse configuration files directly.
- Render terminal UI.
- Execute arbitrary commands from the model.
- Make undeclared policy decisions.
- Hide partial failures.

If execution fails after a branch or commit has already been created, the executor must report the actual state. It must not assume that the entire operation can be rolled back automatically.

## 8. Configuration System

Gus must support both explicit machine-readable configuration and human-readable workflow instructions.

These are separate concerns:

- `config.json` defines settings and permissions in a predictable format.
- `GUS.md` defines workflow preferences and repository-specific guidance.
- `TEMPLATE.md` defines the commit message convention.

Do not overload Markdown instructions as the only source of machine-readable configuration.

### 8.1 Global configuration directory

Use:

```
~/.config/gus/
├── config.json
├── GUS.md
└── TEMPLATE.md
```

All three files are optional, except that Gus must have enough usable configuration to run its requested operation.

### 8.2 Project-level configuration directory

Use:

```
<repository-root>/.gus/
├── config.json
├── GUS.md
└── TEMPLATE.md
```

Project-level configuration is optional. Gus must work in a repository that does not contain a `.gus` directory.

The `.gus` directory is the repository-local location for Gus's settings, instructions, and commit message template.

### 8.3 Configuration example

A configuration file may look like this:

```
{
  "ai": {
    "provider": "openai",
    "model": "your-provider-model-id",
    "temperature": 0.1
  },
  "workflow": {
    "autoCommit": "ask",
    "autoCreateBranch": "ask",
    "autoStage": "ask",
    "splitChanges": "ask",
    "commitStyle": "conventional",
    "defaultBranch": "main"
  },
  "ui": {
    "liveUpdates": true,
    "color": "auto"
  }
}
```

This is an example schema, not a reason to implement every future option immediately.

Use a Zod schema to validate the configuration. Invalid values should result in an actionable error rather than silently reverting to unexpected behavior.

Unknown keys should be handled consistently. Prefer rejecting unsupported settings with a clear explanation unless forward-compatible extension behavior has been deliberately designed.

### 8.4 Automation policy values

Use the following values for supported automation permissions:

- `allow`: Gus may carry out the permitted operation without asking for each occurrence, provided the plan is valid and all safety checks pass.
- `ask`: Gus must request approval before performing the operation.
- `deny`: Gus must not perform the operation automatically.

Apply these semantics consistently across `autoCommit`, `autoCreateBranch`, `autoStage`, and `splitChanges`.

These permissions are independent. For example, allowing automatic branch creation does not automatically permit committing. Allowing commits does not permit staging unrelated or unreviewed changes.

The default settings should be conservative. Use `ask` when the user has not explicitly configured a permission.

### 8.5 Configuration precedence

Resolve configuration using this order, from lowest to highest precedence:

1. Built-in defaults.
2. Global `~/.config/gus/config.json`.
3. Project `.gus/config.json`.
4. Explicit command-line options for the current invocation.

Only explicitly provided CLI options should override stored values.

Configuration precedence does not override application safety invariants. A command-line option or configuration value must not disable validation or authorize an operation that the repository adapter identifies as unsafe.

### 8.6 Secrets and credentials

Do not store API keys in `GUS.md`, `TEMPLATE.md`, checked-in project configuration, logs, or AI prompts.

Use provider-supported environment variables or an appropriate credential mechanism. Do not display secret values during configuration inspection.

Model selection and credential resolution must remain separate. Changing the model should not require editing the workflow implementation.

## 9. GUS.md Instruction Files

`GUS.md` provides natural-language rules for how Gus should organize repository work.

Global instructions live at:

```
~/.config/gus/GUS.md
```

Project instructions live at:

```
<repository-root>/.gus/GUS.md
```

Either file can be absent.

### 9.1 Example instructions

```
# Gus Instructions

## Workflow
- Prefer feature branches for new functionality.
- Do not create a branch for minor changes that clearly belong on the current branch.
- Separate unrelated changes into independent commits.
- Keep closely related changes together.

## Commit Messages
- Use Conventional Commits unless the project template specifies another format.
- Keep summaries concise and descriptive.
- Explain why a change was made when a commit body is necessary.

## Repository Rules
- Never commit secrets or local environment files.
- Do not include unrelated user changes.
- Do not modify files as part of the commit workflow.
- Never rewrite remote history automatically.
```

This is an illustrative instruction file. Users must be able to define their own instructions.

### 9.2 Loading and merging

Load global instructions first and project instructions second.

Project instructions may add detail or override general preferences for that project. Gus should preserve both sources when they do not conflict.

When instructions conflict, apply the more specific project instruction for ordinary preferences. Hard application safety invariants always take precedence.

Pass instructions to the AI as clearly delimited context. Do not concatenate untrusted repository content in a way that makes it appear to be system-level instructions.

The instruction loader should return a structured result that records which files were loaded. It should not contain AI prompt construction or repository operation logic.

## 10. Commit Message Templates

Gus must support a custom `TEMPLATE.md` that defines the format and conventions for generated commit messages.

Global template:

```
~/.config/gus/TEMPLATE.md
```

Project template:

```
<repository-root>/.gus/TEMPLATE.md
```

The project template takes precedence over the global template. If neither exists, Gus uses the configured `commitStyle` and its built-in conventions.

### 10.1 Purpose

A commit template is a formatting contract, not merely a suggestion.

When a template is present, Gus must generate messages that follow its required structure. It must validate the final message before committing. A message that fails validation must be revised, rejected, or presented for manual correction; it must never silently bypass the template.

### 10.2 Template format

Support a documented, simple template format with a dedicated fenced block named `commit-template`. The block defines the structure of a message, and the rest of the Markdown provides rules or examples.

For example:

````
# Commit Message Template

Use the following message structure.

```commit-template
{{type}}{{scope_suffix}}: {{summary}}

{{body}}

{{footer}}
```

## Rules

- Use a lowercase type.
- Keep the summary concise and specific.
- Use the body to explain the reason for a non-obvious change.
- Omit the body or footer when they are not needed.
- Do not include unrelated file changes in the message.
````

Support a small, documented set of placeholders:

| Placeholder        | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `{{type}}`         | Commit type, such as `feat`, `fix`, or `docs`                  |
| `{{scope}}`        | Optional scope value                                           |
| `{{scope_suffix}}` | Parenthesized scope when present; otherwise empty              |
| `{{summary}}`      | Required short summary                                         |
| `{{body}}`         | Optional explanatory text                                      |
| `{{footer}}`       | Optional footer, issue reference, or other configured metadata |

Only the placeholders in the table above are supported. Templates that use another placeholder syntax, such as `<type>`, or that omit the required `{{summary}}` placeholder are rejected with an actionable error.

The template renderer must define how empty optional fields are handled and remove unintended empty lines without altering the required message structure.

Do not implement a general-purpose template language. A small explicit placeholder system is sufficient.

The template loader should:

1. Read the applicable template.
2. Parse the `commit-template` block.
3. Validate that required syntax is supported.
4. Extract relevant rules and examples.
5. Make the template available to planning and validation logic.

The AI can use the template and its accompanying rules to draft messages, but deterministic application logic must validate the final result against enforceable structural rules.

When a template uses conventions that cannot be validated mechanically, Gus should still apply those conventions during planning and provide a clear validation boundary. Do not claim complete enforcement when only semantic guidance is available.

### 10.3 Template precedence

Use the following precedence:

1. Project `.gus/TEMPLATE.md`.
2. Global `~/.config/gus/TEMPLATE.md`.
3. Built-in commit style from the effective configuration.

A project template must override a global template instead of unexpectedly combining two different formatting contracts.

`GUS.md` may contain additional commit preferences, but it must not silently replace the structure defined by an applicable template. If there is an unavoidable conflict, Gus should identify it and request clarification or stop before committing.

## 11. AI Provider and Model Switching

Model selection must be configurable without coupling the application to a particular provider.

The AI infrastructure should expose a common planner interface. A provider registry or resolver maps configured provider and model identifiers to the appropriate SDK implementation.

The application should only know that it can request a validated workflow plan. It must not know which provider's SDK class is being used.

### Requirements

- Read the selected provider and model from effective configuration.
- Allow per-invocation overrides when supported.
- Resolve credentials through the provider's supported credential mechanism.
- Use the same workflow-plan schema across providers.
- Validate every response regardless of provider.
- Distinguish model errors, authentication errors, timeouts, and invalid output.
- Avoid retrying indefinitely.
- Do not create a large custom provider framework before there is a practical need.

### Initial model commands

Provide a small interface for inspecting and configuring model settings, for example:

```
gus models
gus config get ai.provider
gus config get ai.model
gus config set ai.provider openai
gus config set ai.model <model-id>
```

Use the actual supported provider names and model identifiers in implementation and documentation.

Model listing should only claim availability when the underlying provider or configured metadata can establish it. Do not fabricate a list of models or imply that a model was tested when it was not.

## 12. Workflow Planning and Policy Evaluation

The AI planner and policy evaluator must be separate.

### AI planner responsibilities

The planner determines:

- Whether the changes are coherent enough to commit.
- Whether a new branch would be appropriate.
- How to group related changes.
- Which files belong in each proposed commit.
- The proposed message for each commit.
- Any uncertainty requiring manual review.

It should provide concise, useful reasoning that the user can inspect. It should not return arbitrary shell commands or attempt to bypass policy.

### Policy evaluator responsibilities

The policy evaluator determines whether each proposed operation is permitted.

It must inspect:

- Effective configuration.
- Branch-creation permission.
- Staging permission.
- Commit permission.
- Splitting permission.
- Repository state and capabilities.
- Required approvals.
- Template and message validation results.
- Application safety invariants.

Its output should be an explicit decision for each operation, such as allowed, requires approval, denied, or blocked by unsafe state.

The policy evaluator must be deterministic. It must not make a second AI request to decide whether the first AI response is safe to execute.

### Workflow validator responsibilities

The workflow validator checks the plan independently of the model.

At minimum, it must verify that:

- The plan matches the supported schema.
- Every planned path belongs to the inspected change set.
- The same path is not assigned to conflicting commit groups.
- The planned grouping respects the supported staging model.
- A new branch name is present and valid when required.
- Commit messages satisfy the applicable template and message constraints.
- Unsupported or destructive operations are absent.
- The plan does not omit changes without a recognized and explicitly reported reason.
- The plan does not rely on a repository state that has changed since inspection.

The validator must work without a real AI provider so that its behavior can be tested deterministically.

## 13. Safe Repository Operations

Safety must be part of the initial architecture, not a later feature.

### 13.1 Preserve user changes

Gus must not silently discard, overwrite, reset, or rewrite user changes.

It must distinguish pre-existing staged work from unstaged changes and untracked files.

The application must not assume that every existing change belongs to the current task.

If staged and unstaged versions of a file, existing staged files, or other repository conditions make safe commit isolation uncertain, the adapter must use a tested isolation mechanism or stop and explain the problem. It must not stage everything simply because that is convenient.

The initial release may support a deliberately smaller set of safe staging scenarios. Correctly refusing an ambiguous operation is better than committing the wrong changes.

### 13.2 Stage explicitly

Stage only paths authorized by the validated plan and the user's effective policies.

Never use broad staging as a default shortcut when it could include unrelated changes. Avoid operations that silently incorporate ignored files, unrelated files, or unexpected changes that appeared after planning.

For the MVP, grouping is performed at file level. Splitting different changes inside the same file into separate commits is out of scope.

### 13.3 Handle state changes

Repository state can change between inspection, planning, and execution.

Before mutating the repository, check that the relevant state is still compatible with the plan. Reinspect or invalidate the plan when important changes are detected.

Do not execute a stale plan against a materially different repository state.

### 13.4 Stop on unsafe states

Gus must detect relevant conflicts and in-progress repository operations where supported.

Do not automatically commit while an unresolved merge, rebase, cherry-pick, or equivalent operation makes the intended changes uncertain.

If the adapter cannot reliably determine the repository state, block automatic execution and report what the user should inspect.

### 13.5 Validate model output

Treat all AI-produced paths, branch names, and commit messages as untrusted.

Validate them against the inspected repository, supported naming rules, template, and application policy.

Never pass model-generated commands to a shell.

### 13.6 No automatic remote publishing

The initial release must not push commits, publish branches, rewrite remote history, or perform other remote mutations automatically.

The MVP focuses on local repository workflow operations.

### 13.7 Handle partial failure accurately

A branch may be created successfully before a later commit fails. A commit may succeed even if a subsequent verification step fails.

Gus must report completed operations accurately and describe the remaining repository state.

Do not claim that a workflow completed successfully merely because its last attempted command returned. Do not automatically run destructive rollback operations to make the result appear clean.

## 14. Terminal Interaction Design

The CLI should feel responsive without becoming a complicated full-screen application.

Use Clack for interactive prompts and progress indicators. Put its usage behind a small UI layer so that application services do not import Clack.

The UI should support:

- A concise introduction or command header.
- Live progress messages for long-running operations.
- Clear waiting and approval states.
- A structured plan preview.
- Warnings and blocked-operation messages.
- A final result summary.
- Useful error messages with next steps.

### Progress reporting

The UI layer should receive progress events from the application. The application should not write terminal escape sequences or render text directly.

Define a small event model, for example:

```
type WorkflowProgressEvent =
  | { type: "repository.detecting" }
  | { type: "repository.inspecting" }
  | { type: "instructions.loading" }
  | { type: "ai.planning" }
  | { type: "plan.validating" }
  | { type: "approval.required" }
  | { type: "branch.creating"; name: string }
  | { type: "commit.creating"; index: number; total: number }
  | { type: "repository.verifying" }
  | { type: "workflow.completed" };
```

Refine the event types during implementation. Keep them tied to meaningful workflow states.

The application emits events at real state transitions. The UI subscribes and presents them through Clack's spinner, messages, prompts, and final summaries.

### Terminal behavior

- Use standard output for normal results and standard error for diagnostics.
- Respect non-interactive terminals and CI environments.
- Allow colors to be disabled.
- Avoid excessive terminal output.
- Stop or finalize active progress indicators when an operation fails.
- Never hide an error behind a spinner.
- Provide a plain, readable output path when interactive rendering is unavailable.

The UI must not own business state. It renders state received from the application and returns user choices through an explicit interface.

## 15. CLI Commands

The primary command is:

```
gus
```

It runs the default repository workflow.

The initial command surface should remain small.

### Default workflow

```
gus
```

Inspect changes, create a plan, request approvals according to policy, execute approved actions, and verify the result.

### Inspect repository state

```
gus status
```

Display the supported repository's current state and relevant changes without mutating the repository or invoking AI unnecessarily.

### Configure Gus

```
gus config get ai.model
gus config set ai.model <model-id>
```

Configuration commands should validate the setting, explain its scope, and preserve other configuration values.

### Inspect available or configured models

```
gus models
```

Show the configured model and only those additional model options that can be reliably established.

### Initialize project configuration

```
gus init
```

Provide a minimal way to create a project-level `.gus/` directory and optional starter files. Do not overwrite existing user files without explicit approval.

These commands are initial requirements, not a reason to build a large command framework. Add more only when a clear use case exists.

## 16. Error Handling and Observability

Use structured internal errors so that the CLI can report failures consistently.

Expected categories include:

- Invalid CLI arguments.
- Invalid configuration.
- Unsupported repository.
- Unsafe repository state.
- Repository inspection failure.
- AI provider or authentication failure.
- Invalid AI response.
- Plan validation failure.
- Policy denial.
- Approval required in a non-interactive environment.
- Staging or commit failure.
- Final verification failure.

Errors should preserve useful context without exposing credentials, unnecessary environment data, or sensitive repository content.

Use a small logger abstraction where diagnostic output needs to be separated from terminal UI output. Do not introduce a complex logging framework without a requirement.

Define stable process exit behavior. At minimum, distinguish successful completion, invalid input or configuration, and workflow execution failure. Document the exit codes for automation and CI users.

## 17. Testing Strategy

Tests must enforce the architecture and protect against incorrect repository operations.

### 17.1 Unit tests

Unit tests should cover pure logic and isolated behavior, including:

- Configuration validation and precedence.
- Instruction merging.
- Template parsing and rendering.
- Template constraint validation.
- Workflow-plan validation.
- Policy decisions for `allow`, `ask`, and `deny`.
- Branch strategy validation.
- Commit-group validation.
- Error mapping.
- Progress-event creation where useful.

These tests must not require a real AI provider or mutate a real repository.

### 17.2 AI planner tests

Test the planner through a fake model or mocked AI adapter.

Cover:

- Valid plans.
- Malformed structured output.
- Missing files or duplicate file assignments.
- Unsupported branch decisions.
- Messages that violate the template.
- Plans that require manual review.
- Provider failures and timeouts.

The tests should establish that an invalid AI response can never bypass application validation.

### 17.3 Repository adapter tests

Use temporary repositories or isolated test fixtures for repository integration tests.

Test:

- Repository discovery.
- Empty repositories and repositories with changes.
- Added, modified, deleted, and renamed files.
- Staged and unstaged changes.
- Untracked files.
- Paths with spaces and unusual characters.
- Branch creation and checkout.
- Staging selected paths.
- Commit creation.
- Repository states that must block automation.
- Failure and partial-success behavior.

Never run destructive integration tests against the developer's actual working repository.

### 17.4 Workflow integration tests

Use a fake AI planner with a real temporary repository to test the workflow from inspection through verification.

Test separate scenarios for:

- One commit on the current branch.
- Multiple commits on the current branch.
- A new branch followed by one or more commits.
- User approval required.
- An operation denied by policy.
- An invalid plan.
- A failure during branch creation or staging.
- A failure after an earlier commit succeeds.
- A repository that changes after the initial snapshot.
- A custom project template overriding the global template.

### 17.5 CLI tests

Test command parsing, exit codes, output behavior, non-interactive execution, and error presentation.

Do not make tests depend on exact spinner animation frames. Assert meaningful messages and application outcomes instead.

## 18. Implementation Roadmap

Build Gus in small, verifiable phases. Each phase must leave the application in a coherent state.

### Phase 1: Project foundation

Set up TypeScript, Node.js, package scripts, strict compiler settings, the build tool, formatting, linting, and tests.

Create the composition root and establish the module boundaries.

Deliverable: A buildable CLI with a minimal command and a passing test suite.

### Phase 2: Repository adapter

Define the repository contracts, capability model, snapshot model, process runner, and first repository implementation.

Implement safe repository discovery, inspection, branch operations, selected-path staging, and commit creation.

Test the adapter against isolated repositories before adding AI functionality.

Deliverable: Gus can inspect and perform explicitly requested repository operations through the adapter without AI.

### Phase 3: Configuration and instructions

Implement global and project configuration loading, schema validation, precedence, `GUS.md` loading, instruction merging, and template loading.

Implement template parsing and deterministic validation.

Deliverable: Gus can establish the effective settings, instructions, and message template before planning.

### Phase 4: Workflow domain and policy

Define the workflow-plan schema and domain models. Implement deterministic plan validation and policy evaluation.

Write unit tests for all important decisions.

Deliverable: Gus can validate a predefined plan and determine which operations are allowed, require approval, or are blocked.

### Phase 5: AI planner

Integrate the Vercel AI SDK and the initial provider. Implement the planning prompt and structured-output validation.

Test valid, invalid, incomplete, and unsafe plans without permitting the model to execute repository commands.

Deliverable: Gus can turn repository changes and loaded instructions into a validated workflow proposal.

### Phase 6: Workflow orchestration

Implement the application use case that coordinates inspection, planning, validation, approval, execution, and verification.

Keep repository operations in the adapter, policy decisions in the policy evaluator, and model interactions in the AI planner.

Test the complete workflow using a temporary repository and a fake AI planner.

Deliverable: The default workflow can complete or safely refuse a range of end-to-end scenarios.

### Phase 7: CLI experience

Integrate Clack for spinners, progress updates, prompts, plan presentation, and final summaries.

Implement the initial command set, user-facing errors, and non-interactive behavior.

Deliverable: Gus provides a readable, responsive command-line workflow with meaningful live updates.

### Phase 8: Hardening and release

Complete integration tests, validate partial-failure behavior, document configuration and instructions, and prepare the CLI for npm distribution.

Check package metadata, executable permissions, runtime requirements, build output, and installation behavior.

Deliverable: A usable MVP with a documented interface and a repeatable build and test process.

## 19. Definition of MVP Completion

The MVP is complete when a developer can run `gus` in a supported repository and Gus can reliably inspect the current changes, load the applicable instructions and template, obtain a structured AI workflow plan, validate it, apply the configured approval rules, execute the permitted operations, and verify the result.

It must also support switching the configured AI model, creating global and project instructions, and following a custom commit message template.

The MVP must demonstrate that:

- Repository operations are isolated behind an adapter.
- AI provider integration is isolated behind a planner interface.
- Configuration and Markdown files are validated and loaded predictably.
- Templates are applied and validated before commits.
- The AI cannot bypass policy or execute arbitrary commands.
- The application preserves unrelated and pre-existing changes.
- Unsafe or ambiguous states result in a safe refusal.
- Terminal progress reflects actual work.
- Tests cover important success and failure scenarios.
- The project builds, runs, and can be installed using documented instructions.

Do not add advanced features simply because they may be useful in the future. Establish a reliable, extensible foundation first.

## 20. Future Extension Points

The architecture should make the following additions possible without requiring a redesign:

- Additional AI providers.
- Additional repository providers.
- Better change classification and commit grouping.
- Improved handling of large diffs.
- Optional hunk-level splitting.
- More advanced repository capabilities.
- Additional workflow policies.
- Richer terminal presentation.
- Optional model discovery from providers.
- Additional project-level conventions and validation rules.

These are extension points, not MVP commitments. They must not drive premature abstraction or introduce unused frameworks.

A new provider should implement an established interface and pass the same contract tests as the initial implementation.

A new workflow policy should be added to the policy system rather than scattered through CLI commands, AI prompts, or repository adapters.

A new terminal interaction should use the presentation layer rather than adding UI logic to application services.

## 21. Instructions for the Coding Agent

Use this document as the product and architectural foundation for implementing Gus.

Before adding functionality, inspect the existing source structure and identify the intended module boundary. Implement the smallest coherent unit of work and its tests before proceeding to the next one.

Follow these rules throughout implementation:

1. Maintain clear boundaries between the CLI, application, domain, and infrastructure layers.
2. Keep every service and module focused on one responsibility.
3. Do not place repository operations, AI logic, policy decisions, configuration loading, or terminal UI inside unrelated modules.
4. Use explicit interfaces for external dependencies and isolate implementation details.
5. Keep the application repository-agnostic. Repository-specific commands and parsing belong inside the relevant provider adapter.
6. Keep AI provider details inside the AI infrastructure layer.
7. Treat AI output as untrusted and validate it before execution.
8. Use Zod for runtime validation at external boundaries.
9. Preserve user changes and stop when safe execution cannot be established.
10. Use the configured `GUS.md` instructions and `TEMPLATE.md` contract when planning and validating commits.
11. Avoid unnecessary dependencies, duplicate abstractions, speculative features, and premature framework design.
12. Do not create monorepo packages or microservices. Gus is one modular application.
13. Do not hide failures or claim an operation succeeded without verifying the outcome.
14. Write meaningful unit and integration tests for the behavior being introduced.
15. Keep terminal interaction responsive through Clack while ensuring that UI code remains separate from workflow logic.
16. Prefer simple, explicit TypeScript over generic frameworks that make the execution flow harder to understand.
17. Verify dependency APIs against their current stable documentation when implementing them.

The final result should be a professional, maintainable CLI with a clear execution path, predictable automation behavior, and replaceable infrastructure.

Gus's central responsibility is to automate repository workflows reliably. AI helps it understand the changes and propose a plan; application logic validates that plan, enforces policy, and controls every operation.
