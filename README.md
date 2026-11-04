# Gus

AI-assisted repository workflow automation. Gus inspects your repository changes, proposes a
structured workflow plan, asks for approval according to your configuration, and performs only the
approved branch, staging, and commit operations.

Gus is not a coding agent. It manages repository workflows and never lets the AI execute commands.

---

## Quick Start

### 1. Set up your Google API key

Gus defaults to the Google Gemini provider. Set your API key:

```bash
export GOOGLE_API_KEY=your-google-api-key
```

Obtain your key from [Google AI Studio](https://makersuite.google.com/app/apikey).

### 2. Run Gus

```bash
gus
```

Inspect your changes, get a plan, and approve operations.

### 3. Preview without changes

```bash
gus --dry-run
```

### 4. Auto-approve all operations

```bash
gus --yes
```

### 5. Initialize project configuration

```bash
gus init
```

Creates starter files in `.gus/` without overwriting existing files.

---

## Documentation

| Topic | File |
|-------|------|
| Installation | [docs/INSTALLATION.md](docs/INSTALLATION.md) |
| Getting Started | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Configuration | See `gus config` commands |
| CLI Commands | Run `gus --help` |
| Models | `gus models` |

---

## Requirements

- [ ] **Node.js 20 or newer**
- [ ] **Git**
- [ ] **Google API key** — Set `GOOGLE_API_KEY` environment variable

  Get your key from [Google AI Studio](https://makersuite.google.com/app/apikey).

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `gus` | Run the default workflow |
| `gus --dry-run` | Preview the plan without changing the repository |
| `gus --yes` | Approve every operation without prompting |
| `gus --provider google --model gemini-1.5-flash` | Override provider/model for one run |
| `gus status` | Inspect repository state |
| `gus config get ai.model` | Show configured model |
| `gus config set ai.model gemini-1.5-flash` | Set model in project config |
| `gus models` | Show configured provider and model |
| `gus init` | Create project starter files in `.gus/` |

---

## Development

```bash
npm install
npm run dev          # run the CLI from source
npm run build        # bundle to dist/
npm run test:run     # run the test suite once
npm run lint
npm run typecheck
```

---

Gus follows a layered architecture: `cli/` → `application/` → `domain/`, with `infrastructure/`
implementing ports defined by the application. See `MODEL.md` for the full design.

---

*Gus is an AI-assisted repository workflow automation tool. It manages repository workflows
and never lets the AI execute commands.*