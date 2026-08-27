# Changelog

All notable changes to EnvLint are documented here.

## [0.1.0] - 2026-08-27

### Added

- Environment variable consistency detection (.env vs .env.example)
- Runtime version consistency detection (.nvmrc, .node-version, .python-version, etc.)
- Node version mismatch detection with CI vs local severity
- Package manager detection (npm, yarn, pnpm coexistence)
- Invalid script reference detection (README references non-existent npm scripts)
- Docker configuration analysis (EXPOSE, FROM, docker-compose port mappings)
- Documentation consistency checks (localhost URLs, version mentions, install commands)
- GitHub Actions CI/CD analysis (node-version, java-version, python-version)
- Docker image version normalization (strips -alpine, -slim, -bookworm variants)
- Rule-based contradiction engine with per-group and cross-group rules
- FactStore for normalized project facts with grouping
- Confidence scoring per fact (high/medium/low)
- Source-authority scoring (file-type-based authority levels)
- Contradiction scoring (combines confidence, authority, source agreement)
- VS Code diagnostics with stable rule IDs
- EnvLint sidebar tree view with contradiction details
- Status bar contradiction summary with rule IDs
- Quick-fix suggestion support in diagnostics
- Ignore rules by rule ID, category.technology, or wildcard
- Configurable path exclusions
- Debounced workspace file watching (500ms)
- Configuration reactivity (changes trigger rescan)
- Output channel logging
- Integration tests across 6 fixture repositories
- False-positive test coverage documenting known limitations
- 110 automated tests across 12 suites

### Rules

| ID     | Name                          | Severity |
| ------ | ----------------------------- | -------- |
| RUN001 | Runtime version mismatch      | warning  |
| RUN002 | Node version mismatch         | warning/critical |
| CFG001 | Port mismatch                 | warning  |
| CFG002 | Port inconsistency            | warning  |
| ENV001 | Environment variable mismatch | warning  |
| ENV002 | Missing environment variables | warning  |
| PKG001 | Multiple package managers     | warning  |
| PKG002 | Invalid script reference      | critical |
| DOC001 | Invalid script in docs        | critical |

### Supported files

- `.nvmrc`, `.node-version`, `.python-version`, `.ruby-version`, `.tool-versions`
- `package.json` (engines, scripts, packageManager)
- `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`
- `.env`, `.env.example`, `.env.local`, `.env.development`, `.env.production`
- `.github/workflows/*.yml`, `.github/workflows/*.yaml`
- `README.md`, `README.rst`, `README.txt`, `README`

### Known limitations

- Semver ranges in `engines.node` (e.g. `>=18`) are compared as strings, not parsed semantically
- Docker multi-stage `FROM` lines with different versions trigger false positives
- Documentation version recommendations may conflict with actual configuration
- Extra variables in `.env.example` are flagged (by design for templates)
- Package manager mismatch not detected across separate groups (FactStore groups by technology)
- Authority scoring does not yet differentiate high-authority-only disagreement from mixed-authority
