import { PackageJsonExtractor } from '../engine/extractors/packageJson';

describe('PackageJsonExtractor', () => {
  const extractor = new PackageJsonExtractor();

  it('extracts engines.node', () => {
    const result = extractor.extract('package.json', JSON.stringify({
      engines: { node: '>=18' },
    }));
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].category).toBe('runtime');
    expect(result.facts[0].technology).toBe('node');
    expect(result.facts[0].value).toBe('>=18');
  });

  it('extracts packageManager field', () => {
    const result = extractor.extract('package.json', JSON.stringify({
      packageManager: 'pnpm@10.0.0',
    }));
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].category).toBe('package_manager');
    expect(result.facts[0].technology).toBe('pnpm');
    expect(result.facts[0].value).toBe('10.0.0');
  });

  it('extracts scripts', () => {
    const result = extractor.extract('package.json', JSON.stringify({
      scripts: { dev: 'next dev', build: 'next build' },
    }));
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0].metadata?.scriptName).toBe('dev');
    expect(result.facts[1].metadata?.scriptName).toBe('build');
  });

  it('extracts dependencies', () => {
    const result = extractor.extract('package.json', JSON.stringify({
      dependencies: { react: '^18.2.0', next: '14.0.0' },
    }));
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0].category).toBe('dependency');
  });

  it('handles empty package.json', () => {
    const result = extractor.extract('package.json', '{}');
    expect(result.facts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles malformed JSON', () => {
    const result = extractor.extract('package.json', '{invalid');
    expect(result.facts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('extracts engines.npm', () => {
    const result = extractor.extract('package.json', JSON.stringify({
      engines: { npm: '>=9' },
    }));
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].technology).toBe('npm');
  });
});
