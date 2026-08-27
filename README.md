# EnvLint

Catch configuration contradictions before they cause runtime failures.

EnvLint statically analyzes your repository to find inconsistencies between different sources of truth — `.nvmrc` vs `Dockerfile`, `.env` vs `.env.example`, `README` vs `package.json`, and more.

## What it detects

| Rule    | What it finds                                    |
| ------- | ------------------------------------------------ |
| RUN001  | Runtime version mismatch across config files     |
| RUN002  | Node version mismatch (CI vs local vs Docker)    |
| CFG001  | Port mismatch between config files               |
| CFG002  | Port inconsistency across Docker and compose     |
| ENV001  | Environment variable mismatch (.env vs example)  |
| ENV002  | Missing environment variables                    |
| PKG001  | Multiple package managers detected               |
| PKG002  | Invalid script reference in package.json         |
| DOC001  | Invalid script reference in documentation        |

## Example

**.nvmrc**
```
22
```

**Dockerfile**
```dockerfile
FROM node:18-alpine
```

**Result:**
```
RUN002: Node version mismatch

Different sources declare different Node.js versions.

Local/Config: 22
Docker: 18

CI using a different Node version than your local/Docker environment
can cause "works on my machine" issues.
```

## Installation

### From VSIX

```bash
npm run compile
npm run package
code --install-extension envlint-0.1.0.vsix
```

### From source

```bash
git clone https://github.com/envlint/envlint
cd envlint
npm install
npm run compile
```

Then open the project in VS Code and press F5 to launch the Extension Development Host.

## Usage

EnvLint activates automatically when you open a workspace. It:

1. Scans your project for configuration files
2. Extracts facts (versions, ports, env vars, scripts)
3. Detects contradictions between facts
4. Shows findings in the **Problems** panel and **EnvLint** sidebar

### Commands

| Command                  | Description              |
| ------------------------ | ------------------------ |
| `envlint: Scan Project`  | Trigger a manual scan    |
| `envlint: Refresh`       | Re-scan the workspace    |

### Status bar

The status bar shows your project's consistency score:

- **90%+** — green check
- **70-89%** — orange warning
- **<70%** — red error

Critical issues show their rule IDs: `$(error) envlint: 1 critical [RUN002]`

## Configuration

Open VS Code Settings and search for "envlint":

```jsonc
{
  // Enable/disable scanning
  "envlint.enabled": true,

  // Directories to skip
  "envlint.excludePaths": [
    "node_modules", "dist", "build", ".git",
    "out", "coverage", ".next", ".nuxt",
    ".cache", "target"
  ],

  // Suppress specific rules
  "envlint.ignoreRules": [
    { "rule": "RUN002", "reason": "Intentional version difference" },
    { "rule": "ENV002", "files": ["*.test.*"] }
  ],

  // Override severity
  "envlint.severityOverrides": {
    "PKG001": "warning"
  },

  // Use authority scoring
  "envlint.enableAuthorityScoring": true
}
```

### Ignoring rules

You can ignore rules by:

- **Rule ID**: `{ "rule": "RUN002" }` — ignores all RUN002 findings
- **Category**: `{ "rule": "runtime.node" }` — ignores all node runtime findings
- **Wildcard**: `{ "rule": "*" }` — ignores everything

Add `files` to limit suppression to specific files:

```json
{ "rule": "RUN002", "files": ["Dockerfile"] }
```

## Supported files

| Category       | Files                                          |
| -------------- | ---------------------------------------------- |
| Runtime        | `.nvmrc`, `.node-version`, `.python-version`, `.ruby-version`, `.tool-versions` |
| Package        | `package.json` (engines, scripts, packageManager) |
| Docker         | `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml` |
| Environment    | `.env`, `.env.example`, `.env.local`, `.env.development`, `.env.production` |
| CI/CD          | `.github/workflows/*.yml`, `.github/workflows/*.yaml` |
| Documentation  | `README.md`, `README.rst`, `README.txt`, `README` |

## Scoring

Each fact carries a **confidence** level (high/medium/low) and **authority** score (0-100) based on its source file.

| Source                | Authority |
| --------------------- | --------- |
| `.nvmrc`              | 95        |
| `package.json`        | 90        |
| `Dockerfile`          | 85        |
| `.github/workflows`   | 85        |
| `.env.example`        | 80        |
| `.env`                | 75        |
| `README.md`           | 40        |

Authority influences contradiction scoring: disagreements between high-authority sources score higher than disagreements involving documentation.

## Limitations

- **Semver ranges**: `engines.node: ">=18"` vs `.nvmrc: 22` triggers a false positive. Range parsing is not yet implemented.
- **Docker multi-stage builds**: Different `FROM` stages with different versions trigger false positives.
- **Intentional differences**: EnvLint cannot distinguish deliberate configuration differences from accidental ones.
- **Dynamic environment variables**: Variables constructed at runtime (e.g. `process.env[prefix + "_KEY"]`) are not detected.
- **Package manager grouping**: npm/pnpm/yarn conflicts are only detected within the same technology group.

## Testing

```bash
npm test
```

110 tests across 12 suites, including integration tests against fixture repositories and false-positive documentation.

## License

MIT
