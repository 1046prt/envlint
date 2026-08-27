import { GitHubActionsExtractor } from '../engine/extractors/githubActions';

describe('GitHubActionsExtractor', () => {
  const extractor = new GitHubActionsExtractor();

  it('extracts node-version', () => {
    const content = '      - uses: actions/setup-node@v4\n        with:\n          node-version: 20';
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].technology).toBe('node');
    expect(result.facts[0].value).toBe('20');
    expect(result.facts[0].metadata?.ci).toBe('github-actions');
  });

  it('extracts java-version', () => {
    const content = '          java-version: 21';
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts[0].technology).toBe('java');
    expect(result.facts[0].value).toBe('21');
  });

  it('extracts python-version', () => {
    const content = '          python-version: "3.12"';
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts[0].technology).toBe('python');
    expect(result.facts[0].value).toBe('3.12');
  });

  it('extracts go-version', () => {
    const content = '          go-version: "1.22"';
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts[0].technology).toBe('go');
  });

  it('handles quoted versions', () => {
    const content = "          node-version: '18'";
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts[0].value).toBe('18');
  });

  it('handles no version matches', () => {
    const content = '      - run: echo hello';
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts).toHaveLength(0);
  });

  it('sets high authority for CI', () => {
    const content = '          node-version: 20';
    const result = extractor.extract('.github/workflows/ci.yml', content);
    expect(result.facts[0].authority).toBe(85);
    expect(result.facts[0].confidence).toBe('high');
  });
});
