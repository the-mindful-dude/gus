# Gus — Implementation TODO

## Purpose

This document replaces the previous `TODO.md`. It tracks the remaining correctness, safety, integration, testing, and release work identified from the current `main` branch.

The main architecture and core application modules are already present. However, having an implementation for a feature does not necessarily mean its behavior is complete or safe. Tasks below must be verified against the actual implementation and tests before being marked complete.

Priority order: repository safety and change analysis → workflow correctness → AI provider support → integration testing → documentation and release.

## Progress

Every actionable item in this document is tracked as a checkbox. Mark an item `[x]` only after it is
implemented and verified with the repeatable verification commands in section 7.5. The counts below
reflect the total number of items per phase.

| Phase | Status | Completed | Items |
| --- | --- | --- | --- |
| 1. Repository State and Change Analysis | In progress | 24 / 26 | 1.1 (7), 1.2 (7), 1.3 (6), 1.4 (6) |
| 2. Workflow Safety and Execution Correctness | In progress | 12 / 37 | 2.1 (7), 2.2 (8), 2.3 (10), 2.4 (7), 2.5 (5) |
| 3. Prompt Construction and Sensitive Data Handling | Not started | 0 / 15 | 3.1 (7), 3.2 (8) |
| 4. AI Provider Integration and Google Gemini | In progress | 4 / 31 | 4.1 (7), 4.2 (11), 4.3 (8), 4.4 (5) |
| 5. Configuration, Instructions, and Templates | Not started | 0 / 29 | 5.1 (7), 5.2 (6), 5.3 (11), 5.4 (5) |
| 6. Architecture and Module Boundaries | Not started | 0 / 14 | 6.1 (9), 6.2 (5) |
| 7. Testing and Verification | Not started | 0 / 40 | 7.1 (8), 7.2 (8), 7.3 (9), 7.4 (7), 7.5 (8) |
| 8. CI, Documentation, and Release Preparation | Not started | 0 / 19 | 8.1 (5), 8.2 (7), 8.3 (7) |
| 9. Deferred Work | Deferred | 0 / 7 | Intentionally out of scope until the workflow is reliable |
| **Total** | | **36 / 233** | |

## Phase 1: Repository State and Change Analysis

Priority: Critical

### 1.1 Provide the actual changes to the AI planner

- [x] Extend the repository abstraction to retrieve relevant change content, not only filenames and status metadata.
- [x] Retrieve working-tree diffs and staged diffs separately.
- [x] Make the actual relevant changes available to `WorkflowPlanningInput`.
- [x] Handle new and untracked files so the planner can understand their contents without reading the entire repository.
- [x] Replace or remove the incomplete `diff-parser.ts` implementation that currently parses diff-stat output and reports zero additions and deletions.
- [x] Bound the amount of content sent to the model and define how oversized changes are handled.
- [x] Return a clear manual-review or refusal result when the available context is insufficient for reliable planning.

### 1.2 Improve repository status parsing

- [x] Replace line-based Git status parsing with correctly handled NUL-delimited output, such as `git status --porcelain=v1 -z`.
- [x] Request individual untracked files rather than relying on directory-level summaries.
- [x] Correctly parse added, modified, deleted, renamed, copied, untracked, and conflicted changes.
- [x] Preserve both the old and new paths of renamed files.
- [x] Correctly represent changes that have both staged and unstaged modifications.
- [x] Add tests for filenames containing spaces, tabs, newlines, leading special characters, and rename-related edge cases.
- [ ] Check every repository command's exit status before interpreting its output as valid state.

### 1.3 Strengthen repository-state snapshots

- [x] Extend the repository snapshot or introduce a separate immutable planning snapshot that captures enough information to detect meaningful state changes.
- [x] Include the current branch or reference, `HEAD` commit, relevant index state, change metadata, and fingerprints of the relevant diffs.
- [x] Include rename information and all relevant staging-state flags in state comparisons.
- [x] Update stale-plan detection. The current comparison detects changes in branch and status metadata but can miss edits to a file whose path and status remain unchanged.
- [x] Reject a plan when the repository content or index has changed since planning, even if the same filenames remain modified.
- [x] Add tests proving that modifications to a file after planning invalidate the previous plan.

### 1.4 Handle repository metadata correctly

- [x] Replace assumptions that `.git` is always a directory beneath the repository root.
- [x] Use Git metadata commands such as `git rev-parse --git-dir` and `git rev-parse --git-path` to locate repository state files correctly.
- [x] Detect relevant in-progress operations, including merge, rebase, cherry-pick, revert, and sequencer states where applicable.
- [x] Verify behavior with Git worktrees and repositories with non-standard Git directory layouts.
- [x] Ensure that unsupported or ambiguous states result in a clear refusal rather than a partially informed workflow.
- [ ] Use the repository capability interface to determine whether an operation is supported before planning or executing it.

## Phase 2: Workflow Safety and Execution Correctness

Priority: Critical — complete before enabling unattended commits as a normal workflow.

### 2.1 Enforce repository safety throughout execution

- [ ] Reject pre-existing staged work before sending repository content to the AI provider, since the current workflow ultimately refuses to mix that work into Gus-managed commits.
- [ ] Keep the existing staged-work refusal unless a separate, explicitly designed and tested workflow is introduced for preserving and isolating staged changes.
- [ ] Revalidate repository state after all approval prompts and immediately before the first mutation.
- [ ] Recheck relevant state before each subsequent staging and commit operation.
- [ ] Reject stale plans if files, diffs, branch state, or index state change while the user is reviewing the plan.
- [ ] Ensure that changes introduced between inspection and execution cannot be silently incorporated into a commit.
- [ ] Ensure that unresolved conflicts or unsupported repository states block automatic execution.

### 2.2 Make staging precise

- [ ] Ensure repository paths are treated as literal paths rather than Git pathspec expressions where the adapter expects exact filenames.
- [ ] Update `stagePaths` or its contract to handle renamed files, including old and new paths where required.
- [ ] Ensure deletions and renames are staged correctly without including unrelated changes.
- [ ] Verify that each commit contains only the paths assigned to its validated commit group.
- [ ] Prevent one commit group from staging changes intended for another group.
- [ ] Check the index before every commit and ensure no unexpected staged changes have appeared.
- [ ] Refuse ambiguous mixed staged/unstaged cases until a tested isolation strategy can safely handle them.
- [ ] Do not introduce hunk-level splitting in this phase.

### 2.3 Improve workflow execution and verification

- [ ] Keep policy evaluation, approval handling, and repository mutation separate.
- [ ] Preserve the existing behavior where all required approvals are collected before the first mutation.
- [ ] Confirm that `allow`, `ask`, and `deny` are enforced consistently for branch creation, staging, committing, and splitting changes.
- [ ] Ensure a denied or rejected operation cannot lead to an unintended alternative workflow.
- [ ] Check repository capabilities before attempting branch creation, staging, or commits.
- [ ] Preserve the details of partial failures, including the operation that failed, the reason, completed operations, and any remaining repository changes.
- [ ] Verify the expected branch, number of commits, commit messages, commit identifiers, and planned file assignments after execution.
- [ ] Do not treat an empty working tree as sufficient proof that the intended workflow completed correctly.
- [ ] Verify that no unplanned files or changes were committed.
- [ ] Ensure a failed final verification produces a clear failure result without attempting unsafe automatic rollback.

### 2.4 Improve process execution reliability

- [x] Fix `ProcessRunner` so that a process terminated without a numeric exit code cannot be reported as successful.
- [x] Preserve process failures, exit codes, and termination signals in the process-runner result or error model.
- [x] Ensure spawn failures and other execution errors are reported accurately.
- [x] Keep process execution behind the infrastructure boundary.
- [x] Continue passing executable names and argument arrays rather than constructing shell command strings.
- [x] Add tests for non-zero exit codes, process termination, missing executables, and command failures.
- [x] Ensure the Git adapter checks the exit status when retrieving the commit SHA after a successful commit command.

### 2.5 Validate branch names and operations

- [x] Verify branch names against the rules of the active repository provider before creating a branch.
- [x] Add tests for invalid names, reserved sequences, invalid components, and existing branches.
- [x] Where Git is the active provider, use Git's own branch-name validation as an authoritative final check.
- [x] Keep repository-specific validation inside the Git adapter or a clearly defined provider-specific boundary.
- [x] Ensure branch creation failure stops the workflow before staging or committing changes.

## Phase 3: Prompt Construction and Sensitive Data Handling

Priority: High

### 3.1 Correct the workflow-planning prompt

- [ ] Pass the actual relevant diff context to the planner.
- [ ] Separate trusted application-level instructions, user-defined Gus instructions, commit templates, and untrusted repository content into clearly defined prompt sections.
- [ ] Fix the current prompt wording that labels the instruction block as data whose instructions must never be followed. The prompt must distinguish authorized `GUS.md` instructions from untrusted text inside repository files and diffs.
- [ ] Treat repository file contents, diffs, commit history, and other discovered text as untrusted input that cannot override application safety rules.
- [ ] Keep prompt construction isolated from workflow execution and terminal presentation.
- [ ] Include the effective commit style, template, current branch, default branch, and other relevant settings without duplicating contradictory instructions.
- [ ] Test the prompt builder using representative repositories, malicious-looking file content, custom instructions, and different templates.

### 3.2 Protect repository content sent to providers

- [ ] Add configurable file exclusions for sensitive or irrelevant paths.
- [ ] Avoid transmitting environment files, API keys, private credentials, and other obvious secrets.
- [ ] Implement appropriate secret-redaction checks before provider requests.
- [ ] Apply limits to the number and size of diffs sent to the model.
- [ ] Provide a clear warning and documentation about what repository content is sent to the selected provider.
- [ ] Document the data-use terms of free-tier providers. In particular, Google's Gemini Developer API free tier states that submitted content may be used to improve Google products.
- [ ] Provide an explicit, understandable configuration or first-use acknowledgement for the privacy implications of sending repository content to a free-tier provider.
- [ ] Never log secret values or unnecessary repository content.

Reference: [Gemini API pricing and data-use terms](https://ai.google.dev/gemini-api/docs/pricing?utm_source=chatgpt.com).

## Phase 4: AI Provider Integration and Google Gemini

Priority: High

### 4.1 Modernize the AI SDK integration

- [ ] Review the currently locked AI SDK dependencies before adding another provider. The repository currently uses `ai` v4 and `@ai-sdk/openai` v1.
- [ ] Choose a compatible, maintained AI SDK version and upgrade the core SDK and provider packages together.
- [ ] If migrating to AI SDK v7, follow the official migration guide and account for its Node.js 22 minimum and ESM requirements.
- [ ] Update `AiSdkPlannerAdapter`, model interfaces, structured-output handling, and error mapping to the selected SDK version.
- [ ] Keep the planner contract provider-neutral so that changing SDK versions or providers does not require rewriting application workflow logic.
- [ ] Confirm that structured workflow-plan generation is supported by the selected provider and model.
- [ ] Test the selected model's schema-constrained output behavior rather than assuming all providers behave identically.

References: [AI SDK 7 release and migration requirements](https://vercel.com/changelog/ai-sdk-7?utm_source=chatgpt.com) · [AI SDK provider documentation](https://ai-sdk.dev/docs/foundations/providers-and-models?utm_source=chatgpt.com).

### 4.2 Add Google Gemini as the default provider

- [x] Add the compatible Google provider package, `@ai-sdk/google`.
- [x] Implement a dedicated Google provider adapter that conforms to the existing AI provider contract.
- [x] Keep Google-specific SDK usage and credential handling inside `src/infrastructure/ai/`.
- [x] Register Google in `AiProviderRegistry`.
- [x] Make Google the default provider in `DEFAULT_CONFIGURATION`.
- [x] Select a Gemini model that is currently available on Google's free tier and suitable for structured workflow planning.
- [x] Keep the model identifier configurable and document that model availability and free-tier quotas can change.
- [x] Use the provider's documented API-key environment variable and never store API keys in project configuration or Markdown instructions.
- [x] Retain OpenAI as an optional provider.
- [x] Update `README.md`, `MODEL.md`, `AGENTS.md`, and initialization templates to reflect the supported providers and default configuration.
- [ ] Update CLI integration tests so they do not assume that OpenAI is the only provider or that `OPENAI_API_KEY` is always required.

Reference: [Google Generative AI provider for the Vercel AI SDK](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai?utm_source=chatgpt.com).

### 4.3 Correct provider resolution and error handling

- [ ] Ensure the configured provider and model are resolved from the effective configuration.
- [ ] Make `ModelResolver` reject unknown providers with a clear list of supported providers.
- [ ] Ensure the registry is populated consistently in every command that requires provider information.
- [ ] Avoid creating redundant model instances during provider and planner resolution when one instance can be reused.
- [ ] Replace generic authentication errors that specifically mention `OPENAI_API_KEY` with provider-aware errors or guidance.
- [ ] Preserve distinctions between missing credentials, invalid credentials, rate limits, timeouts, unavailable models, network failures, and invalid structured output.
- [ ] Avoid logging provider responses that might contain sensitive repository content.
- [ ] Add tests for provider selection, model defaults, unknown providers, missing credentials, provider errors, and structured-output validation.

### 4.4 Complete model configuration behavior

- [ ] Ensure `gus models` displays the effective project configuration when run inside a repository.
- [ ] Ensure `gus config get` resolves values against the current repository's configuration, not only global defaults.
- [ ] Keep the existing distinction between supported providers and provider-specific model catalogues.
- [ ] Do not claim that a model is available or tested unless that can be established reliably.
- [ ] Verify model switching through both configuration files and per-run CLI overrides.

## Phase 5: Configuration, Instructions, and Templates

Priority: High

### 5.1 Fix effective configuration resolution

- [ ] Resolve configuration consistently using built-in defaults, global configuration, project configuration, and explicit per-run overrides.
- [ ] Fix `config get` so it passes the detected repository root to `ManageConfigUseCase.get`.
- [ ] Fix `gus models` so it resolves the current project's effective provider and model.
- [ ] Add CLI tests proving that project settings override global settings for reads as well as workflow execution.
- [ ] Ensure `config set` preserves unrelated values and rejects invalid keys or values.
- [ ] Consider atomic configuration writes using a temporary file and rename to reduce the chance of leaving a partially written configuration.
- [ ] Either implement the documented `ui.color` setting or remove it from the supported configuration interface until its behavior is implemented.

### 5.2 Handle instruction-file errors

- [ ] Stop silently ignoring unreadable global or project `GUS.md` files.
- [ ] Return clear errors or explicit warnings that identify the affected file.
- [ ] Continue supporting optional instruction files.
- [ ] Keep global and project instruction loading separate from prompt construction.
- [ ] Ensure project instructions are combined with global instructions while application-level safety invariants retain precedence.
- [ ] Add tests for absent files, unreadable files, empty files, and conflicting instructions.

### 5.3 Unify the commit-template contract

- [ ] Define one canonical placeholder syntax for `TEMPLATE.md`.
- [ ] Align the syntax used by `gus init`, `TemplateLoader`, `renderTemplate`, `validateCommitMessage`, and `MODEL.md`.
- [ ] Resolve the current inconsistency where the generated template uses placeholders such as `<type>` while the renderer expects placeholders such as `{{type}}`.
- [ ] Validate that a template contains a valid `commit-template` block.
- [ ] Reject unsupported placeholders and malformed templates with actionable errors.
- [ ] Ensure template validation cannot silently pass merely because the template block is missing or unparseable.
- [ ] Support optional scope, body, and footer fields according to the documented template contract.
- [ ] Define how optional sections and blank lines are rendered.
- [ ] Keep deterministic formatting and validation outside the AI prompt.
- [ ] Ensure template-specific commit messages are validated before any repository mutation.
- [ ] Add unit tests covering global fallback, project precedence, malformed templates, unknown placeholders, optional fields, subject limits, and invalid commit messages.

### 5.4 Finish initialization behavior

- [ ] Ensure `gus init` creates the intended starter files without overwriting existing files.
- [ ] Make the generated configuration use Google's default provider after Gemini integration is complete.
- [ ] Ensure the starter template uses the canonical placeholder syntax.
- [ ] Keep the generated `GUS.md`, `TEMPLATE.md`, and `config.json` consistent with the documented configuration contract.
- [ ] Add tests for partial initialization, repeated initialization, and existing files.

## Phase 6: Architecture and Module Boundaries

Priority: Medium

### 6.1 Preserve the modular architecture

- [ ] Keep the CLI responsible for parsing arguments, invoking use cases, and rendering terminal output.
- [ ] Keep application services responsible for coordinating workflow steps rather than directly implementing repository, provider, or filesystem behavior.
- [ ] Keep domain logic independent of CLI libraries, SDK provider types, filesystem implementations, and subprocess APIs.
- [ ] Keep provider-specific behavior inside infrastructure adapters.
- [ ] Keep repository-specific commands and output parsing inside the Git repository adapter.
- [ ] Use explicit dependency injection and avoid mutable global service containers.
- [ ] Prevent circular imports and imports of private implementation files across module boundaries.
- [ ] Review whether `RepositoryProviderRegistry` is actually needed for the initial release. Either wire it into composition behind the repository interface or defer the registry until a second provider is justified.
- [ ] Avoid introducing separate packages, plugin frameworks, or speculative abstractions without a concrete requirement.

### 6.2 Improve error and result consistency

- [ ] Ensure expected domain and infrastructure failures use appropriate error types.
- [ ] Avoid converting specific provider or repository errors into generic errors unnecessarily.
- [ ] Ensure operation results accurately represent executed, skipped, rejected, blocked, and failed operations.
- [ ] Keep exit-code mapping centralized and test it against all user-facing error categories.
- [ ] Ensure logs, progress indicators, and final output report the same actual workflow outcome.

## Phase 7: Testing and Verification

Priority: High

### 7.1 Expand repository adapter tests

- [ ] Add tests for NUL-delimited status parsing and filenames with unusual characters.
- [ ] Test renamed and deleted files through the actual Git adapter.
- [ ] Test repositories with both staged and unstaged changes to the same file.
- [ ] Test that exact-path staging does not stage unrelated files.
- [ ] Test worktrees and repository metadata paths where supported.
- [ ] Test merge, rebase, cherry-pick, revert, and conflict detection.
- [ ] Test failed commands and invalid commit-SHA results.
- [ ] Test `ProcessRunner` behavior when processes fail or terminate without a numeric exit code.

### 7.2 Expand planner and validator tests

- [ ] Test that every changed file is assigned to exactly one commit group.
- [ ] Test that model-generated paths outside the inspected change set are rejected.
- [ ] Test duplicate assignments and empty commit groups.
- [ ] Test invalid branch names and unsupported operations.
- [ ] Test commit messages against both built-in conventions and custom templates.
- [ ] Test malformed AI output and provider failures.
- [ ] Test prompt construction when instructions and repository content contain conflicting or malicious-looking text.
- [ ] Ensure tests do not require live API calls.

### 7.3 Expand executor and workflow tests

- [ ] Test all combinations of `allow`, `ask`, and `deny` for branch creation, staging, committing, and splitting changes.
- [ ] Verify that declining any required approval results in no repository mutations.
- [ ] Verify that a policy denial cannot cause a commit using pre-existing staged changes.
- [ ] Test repository changes occurring while the user is reviewing approval prompts.
- [ ] Test file contents changing while the planned paths remain identical.
- [ ] Test failures during branch creation, staging, commit creation, and verification.
- [ ] Test accurate reporting when an earlier commit succeeds and a later commit fails.
- [ ] Add an integration suite that uses a real temporary Git repository and a fake AI planner to exercise the complete inspect → plan → approve → execute → verify flow.
- [ ] Ensure no automated test mutates the developer's actual working repository.

### 7.4 Expand CLI and packaging tests

- [ ] Test the built CLI executable, not only `tsx` execution from source.
- [ ] Test that bare `gus` starts the default workflow.
- [ ] Test `gus run`, `gus status`, `gus config`, `gus models`, and `gus init`.
- [ ] Test `--dry-run`, `--yes`, `--provider`, and `--model`.
- [ ] Verify that dry-run never mutates the repository.
- [ ] Test non-interactive approval behavior and all documented exit codes.
- [ ] Test the npm executable entry and the published package's built files.

### 7.5 Establish repeatable verification

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Test the resulting CLI from `dist/`.
- [ ] Test package contents with `npm pack --dry-run`.
- [ ] Verify that no credentials, local configuration, temporary repositories, or unintended files are included in the package.
- [ ] Fix all failures before marking a task complete.

## Phase 8: CI, Documentation, and Release Preparation

Priority: Medium

### 8.1 Add continuous integration

- [x] Add a GitHub Actions workflow for pushes and pull requests.
- [x] Run type checking, linting, tests, and builds in CI.
- [x] Test against the Node.js versions that Gus officially supports.
- [ ] If the selected AI SDK requires Node.js 22 or newer, update `package.json`, README requirements, and CI accordingly.
- [x] Keep CI independent of live provider API keys by using fake providers for automated workflow tests.

### 8.2 Update documentation

- [x] Update `README.md` to describe the actual supported behavior, Google provider setup, OpenAI setup, privacy implications, configuration, and troubleshooting.
- [x] Update `MODEL.md` to reflect the implemented architecture, repository snapshot and diff contracts, provider integration, template syntax, and safety checks.
- [x] Update `AGENTS.md` if implementation rules or architecture boundaries change.
- [x] Remove statements that promise behavior not yet implemented or verified.
- [x] Document the actual requirements for running Gus from source and installing the built package.
- [x] Document free-tier limitations without promising unlimited or permanent free access.
- [x] Document the distinction between `--yes`, per-operation approval policies, and safety invariants.

### 8.3 Prepare the package for distribution

- [x] Confirm the package name and npm publication strategy.
- [ ] Choose and add an appropriate open-source license before public release.
- [x] Confirm package metadata, binary entry point, ESM output, and runtime requirements.
- [x] Verify that the package contains only intended build artifacts and required metadata.
- [x] Test global and temporary installation in a clean environment.
- [x] Add a release checklist and versioning process.
- [x] Publish only after the safety-critical tests and documented commands have been verified.

## Phase 9: Deferred Work

These items are intentionally out of the immediate implementation scope. Do not start them until the current workflow is reliable.

- [ ] Add hunk-level staging and splitting when file-level isolation is proven reliable.
- [ ] Add more AI providers after Google and OpenAI are properly isolated and tested.
- [ ] Add additional repository providers when a real use case justifies them.
- [ ] Consider richer model discovery only when provider APIs can supply accurate supported-model information.
- [ ] Consider advanced terminal presentation only when the existing Clack-based interface proves insufficient.
- [ ] Consider remote branch publishing or other remote operations only through a separate, explicit safety design.
- [ ] Avoid adding automatic history rewriting, destructive cleanup, or general-purpose command execution to the core workflow.

## Completion Criteria

Gus is ready for its next release when:

- [ ] The CLI builds, installs, and invokes the intended entry point correctly.
- [ ] The AI planner receives actual, bounded change content.
- [ ] The prompt distinguishes authorized Gus instructions from untrusted repository content.
- [ ] Google Gemini can be selected through configuration and works with a compatible AI SDK version.
- [ ] Provider-specific credentials and errors are handled correctly.
- [ ] Configuration, instruction files, and commit templates are resolved and validated consistently.
- [ ] Approval policies are enforced before any mutation.
- [ ] Repository state is revalidated after approvals and before execution steps.
- [ ] Gus cannot silently include unrelated or pre-existing staged changes.
- [ ] Repository operations use safe path handling and report failures accurately.
- [ ] Final verification checks the expected results rather than only whether the working tree is clean.
- [ ] Unit, integration, and CLI tests cover critical success and failure scenarios.
- [ ] CI runs type checking, linting, tests, and builds.
- [ ] README and architecture documentation match the actual implementation.
- [ ] All safety-critical tasks in Phases 1–5 and the required tests in Phase 7 are complete.

Guiding principle: Gus should automate repository workflows reliably. The model proposes a plan; deterministic application logic validates it, enforces policy, protects user changes, and controls every repository operation.
