import { DocumentationExtractor } from '../engine/extractors/documentation';

describe('DocumentationExtractor', () => {
  const extractor = new DocumentationExtractor();

  it('extracts npm run commands', () => {
    const result = extractor.extract('README.md', 'Run `npm run dev` to start');
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].category).toBe('script');
    expect(result.facts[0].metadata?.scriptName).toBe('dev');
    expect(result.facts[0].confidence).toBe('low');
  });

  it('extracts localhost URLs with ports', () => {
    const result = extractor.extract('README.md', 'Visit http://localhost:8080');
    expect(result.facts.some(f => f.category === 'port')).toBe(true);
    const portFact = result.facts.find(f => f.category === 'port');
    expect(portFact!.value).toBe('8080');
  });

  it('extracts Node version mentions', () => {
    const result = extractor.extract('README.md', 'Requires Node 22');
    expect(result.facts.some(f => f.technology === 'node')).toBe(true);
  });

  it('extracts Python version mentions', () => {
    const result = extractor.extract('README.md', 'Requires Python 3.12');
    expect(result.facts.some(f => f.technology === 'python')).toBe(true);
  });

  it('extracts install commands', () => {
    const result = extractor.extract('README.md', 'Run npm install');
    expect(result.facts.some(f => f.category === 'package_manager')).toBe(true);
  });

  it('does NOT extract npm install as a script', () => {
    const result = extractor.extract('README.md', 'Run npm install');
    expect(result.facts.every(f => f.category !== 'script')).toBe(true);
  });

  it('extracts pnpm run commands', () => {
    const result = extractor.extract('README.md', 'pnpm run build');
    expect(result.facts[0].metadata?.scriptName).toBe('build');
  });

  it('sets low authority for docs', () => {
    const result = extractor.extract('README.md', 'Node 22');
    expect(result.facts[0].authority).toBe(40);
  });

  it('handles empty README', () => {
    const result = extractor.extract('README.md', '');
    expect(result.facts).toHaveLength(0);
  });
});
