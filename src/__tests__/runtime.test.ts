import { RuntimeExtractor } from '../engine/extractors/runtime';

describe('RuntimeExtractor', () => {
  const extractor = new RuntimeExtractor();

  describe('.nvmrc', () => {
    it('extracts node version', () => {
      const result = extractor.extract('.nvmrc', '22');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].category).toBe('runtime');
      expect(result.facts[0].technology).toBe('node');
      expect(result.facts[0].value).toBe('22');
      expect(result.facts[0].confidence).toBe('high');
      expect(result.facts[0].authority).toBe(95);
    });

    it('handles v prefix', () => {
      const result = extractor.extract('.nvmrc', 'v20.11.0');
      expect(result.facts[0].value).toBe('20.11.0');
    });

    it('handles LTS aliases', () => {
      const result = extractor.extract('.nvmrc', 'lts/hydrogen');
      expect(result.facts[0].value).toBe('lts/hydrogen');
    });

    it('skips comments', () => {
      const result = extractor.extract('.nvmrc', '# This is a comment\n22');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].value).toBe('22');
    });

    it('skips empty lines', () => {
      const result = extractor.extract('.nvmrc', '\n\n22\n\n');
      expect(result.facts).toHaveLength(1);
    });

    it('sets correct line number', () => {
      const result = extractor.extract('.nvmrc', '22');
      expect(result.facts[0].source.line).toBe(1);
    });

    it('sets correct line number for multi-line', () => {
      const result = extractor.extract('.nvmrc', '# comment\n22');
      expect(result.facts[0].source.line).toBe(2);
    });
  });

  describe('.node-version', () => {
    it('extracts node version', () => {
      const result = extractor.extract('.node-version', '22');
      expect(result.facts[0].technology).toBe('node');
    });
  });

  describe('.python-version', () => {
    it('extracts python version', () => {
      const result = extractor.extract('.python-version', '3.12.1');
      expect(result.facts[0].technology).toBe('python');
      expect(result.facts[0].value).toBe('3.12.1');
    });
  });

  describe('.ruby-version', () => {
    it('extracts ruby version', () => {
      const result = extractor.extract('.ruby-version', '3.2.2');
      expect(result.facts[0].technology).toBe('ruby');
      expect(result.facts[0].value).toBe('3.2.2');
    });
  });

  describe('.tool-versions (asdf)', () => {
    it('extracts node version from tool-versions', () => {
      const result = extractor.extract('.tool-versions', 'nodejs 22.0.0');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].technology).toBe('node');
      expect(result.facts[0].value).toBe('22.0.0');
      expect(result.facts[0].source.line).toBe(1);
    });

    it('extracts multiple tools', () => {
      const result = extractor.extract('.tool-versions', 'nodejs 22.0.0\npython 3.12.1\nruby 3.2.2');
      expect(result.facts).toHaveLength(3);
      expect(result.facts[0].technology).toBe('node');
      expect(result.facts[1].technology).toBe('python');
      expect(result.facts[2].technology).toBe('ruby');
    });

    it('sets correct line numbers', () => {
      const result = extractor.extract('.tool-versions', 'nodejs 22.0.0\npython 3.12.1');
      expect(result.facts[0].source.line).toBe(1);
      expect(result.facts[1].source.line).toBe(2);
    });

    it('skips comments in tool-versions', () => {
      const result = extractor.extract('.tool-versions', '# asdf plugin versions\nnodejs 22.0.0');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].source.line).toBe(2);
    });

    it('ignores unknown tools', () => {
      const result = extractor.extract('.tool-versions', 'erlang 26.0\nnodejs 22.0.0');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].technology).toBe('node');
    });

    it('handles nodejs alias', () => {
      const result = extractor.extract('.tool-versions', 'node 22.0.0');
      expect(result.facts[0].technology).toBe('node');
    });
  });

  describe('edge cases', () => {
    it('returns empty for unknown version format', () => {
      const result = extractor.extract('.nvmrc', 'not-a-version');
      expect(result.facts).toHaveLength(0);
    });

    it('returns empty for empty file', () => {
      const result = extractor.extract('.nvmrc', '');
      expect(result.facts).toHaveLength(0);
    });

    it('handles whitespace', () => {
      const result = extractor.extract('.nvmrc', '  22  ');
      expect(result.facts[0].value).toBe('22');
    });
  });
});
