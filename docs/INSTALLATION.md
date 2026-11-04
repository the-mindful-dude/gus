# Installation

Gus can be installed and used in several ways, depending on your needs:

## Option 1: Run without installing (recommended for testing)

```bash
npx gus
```

This downloads and runs the latest version of Gus directly from the command line without any local installation.

## Option 2: Global installation

```bash
npm install -g gus
```

This installs the Gus CLI globally on your system, making the `gus` command available anywhere.

## Option 3: Run from source

```bash
# Clone the repository
git clone https://github.com/Muhammad-Jay/gus.git

# Navigate to the project
cd gus

# Install dependencies
npm install

# Run the CLI from source
npx gus
```

## Option 4: Build and run the distributed package

```bash
# From the project root
npm run build

# The CLI binary is available at ./dist/cli/main.js
# Or install it globally:
npm install -g .
```

## Requirements

- [ ] **Node.js 20 or newer**
- [ ] **Git** (for repository operations)
- [ ] **Google API key** (if using the default Google Gemini provider)

  Set the environment variable:

  ```bash
  export GOOGLE_API_KEY=your-google-api-key
  ```

  Obtain an API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

## Verification

After installation, verify Gus is working:

```bash
gus --help
```

Or check the version:

```bash
gus --version
```

---

*Gus is an AI-assisted repository workflow automation tool. It inspects your repository changes, proposes a structured workflow plan, and performs only the approved branch, staging, and commit operations.*