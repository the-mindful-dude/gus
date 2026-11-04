# Getting Started

Welcome to Gus! This guide will help you get up and running quickly.

## 1. Set up your Google API key

Gus defaults to the Google Gemini provider. Set your API key:

```bash
export GOOGLE_API_KEY=your-google-api-key
```

Obtain your key from [Google AI Studio](https://makersuite.google.com/app/apikey).

## 2. Initialize Gus in your repository

Run Gus for the first time in your repository:

```bash
gus
```

Gus will:

1. Detect your repository
2. Inspect your changes
3. Propose a workflow plan
4. Ask for approval (unless configured with `--yes`)
5. Execute approved operations
6. Verify the final state

## 3. Try it with `--dry-run`

Preview the plan without making any changes:

```bash
gus --dry-run
```

## 4. Auto-approve all operations

In CI or scripting environments, approve every operation without prompting:

```bash
gus --yes
```

## 5. Override provider or model for one run

```bash
gus --provider google --model gemini-1.5-flash
```

Or override via configuration:

```bash
gus config set ai.model gemini-1.5-pro
```

## 6. Check your configuration

```bash
gus models
```

Shows the currently configured provider and model.

```bash
gus config get ai.provider
gus config get ai.model
```

## 7. Initialize project configuration

Create starter files in `.gus/` without overwriting existing files:

```bash
gus init
```

This creates `.gus/GUS.md`, `.gus/TEMPLATE.md`, and `.gus/config.json`.

## 8. Inspect repository state

```bash
gus status
```

Displays your repository's current state and changes without invoking AI.

---

## Next Steps

- Read the [configuration reference](#) to customize Gus's behavior
- Review the [template system](#) for commit message formatting
- Check the [exit codes](#) for automation and CI usage

---

*Gus is not a coding agent. It manages repository workflows and never lets the AI execute commands.*