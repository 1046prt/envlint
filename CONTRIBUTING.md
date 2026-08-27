# Contributing to EnvLint

## Development

```bash
npm install
npm run compile
```

Press F5 in VS Code to launch the Extension Development Host.

## Testing

```bash
npm test
```

All new features must include tests. Place them in `src/__tests__/`.

## Adding a rule

1. Create the rule class in `src/rules/index.ts`
2. Assign a stable ID: `RUN003`, `CFG003`, `ENV003`, etc.
3. Set `ruleId` on every contradiction returned
4. Add the rule to `rules` or `crossGroupRules` array
5. Add tests in `src/__tests__/rules.test.ts`
6. Add a fixture in `fixtures/` if applicable
7. Add an integration test in `src/__tests__/integration.test.ts`

## Adding an extractor

1. Create the extractor in `src/engine/extractors/`
2. Implement `FactExtractor` interface
3. Register in `src/engine/extractors/index.ts`
4. Add tests in `src/__tests__/`
5. Update `README.md` supported files table

## Rule ID format

```
[CATEGORY][NNN]
```

Categories:
- `RUN` — runtime version
- `CFG` — configuration
- `ENV` — environment variables
- `PKG` — package management
- `DOC` — documentation

## Commit messages

Use conventional commits:

```
feat: add Python version extractor
fix: normalize Docker image tags
test: add false-positive test for semver ranges
docs: update supported files table
```

## Code style

- No comments unless requested
- TypeScript strict mode
- One test file per source file
- Tests must pass before merge
