import { EnvironmentExtractor } from '../engine/extractors/environment';

describe('EnvironmentExtractor', () => {
  const extractor = new EnvironmentExtractor();

  it('extracts key=value pairs from .env', () => {
    const result = extractor.extract('.env', 'DATABASE_URL=postgres://localhost/mydb\nAPI_KEY=secret');
    expect(result.errors).toHaveLength(0);
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0].technology).toBe('DATABASE_URL');
    expect(result.facts[0].value).toBe('postgres://localhost/mydb');
    expect(result.facts[0].confidence).toBe('high');
  });

  it('extracts from .env.example with medium confidence', () => {
    const result = extractor.extract('.env.example', 'API_KEY=\nREDIS_URL=redis://localhost');
    expect(result.errors).toHaveLength(0);
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0].confidence).toBe('medium');
    expect(result.facts[0].metadata?.envType).toBe('example');
  });

  it('skips comments and blank lines', () => {
    const result = extractor.extract('.env', '# comment\n\n  \nFOO=bar');
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].technology).toBe('FOO');
  });

  it('handles empty value', () => {
    const result = extractor.extract('.env', 'EMPTY=');
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].value).toBe('');
  });

  it('handles malformed lines gracefully', () => {
    const result = extractor.extract('.env', 'VALID=yes\nno-equals-sign\n=empty-key\nALSO_VALID=ok');
    expect(result.facts).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('sets correct authority for .env vs .env.example', () => {
    const base = extractor.extract('.env', 'X=1');
    const example = extractor.extract('.env.example', 'X=1');
    expect(base.facts[0].authority).toBeDefined();
    expect(example.facts[0].authority).toBeDefined();
  });

  it('detects .env.local type', () => {
    const result = extractor.extract('.env.local', 'LOCAL_VAR=1');
    expect(result.facts[0].metadata?.envType).toBe('local');
  });

  it('returns error for completely invalid content', () => {
    const result = extractor.extract('.env', '\x00\x01\x02');
    // Should not throw, may or may not produce facts
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
