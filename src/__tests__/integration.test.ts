import * as fs from 'fs';
import * as path from 'path';
import { extractors } from '../engine/extractors';
import { FactStore } from '../engine/factStore';
import { ContradictionEngine } from '../engine/contradictionEngine';

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures');
const engine = new ContradictionEngine();

function fileMatchesPattern(filePath: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const prefix = pattern.split('*')[0];
    const suffix = pattern.split('*').slice(1).join('*');
    return filePath.startsWith(prefix) && filePath.endsWith(suffix);
  }
  return filePath === pattern || filePath.endsWith(pattern);
}

function scanFixture(fixtureName: string) {
  const fixtureDir = path.join(FIXTURES_DIR, fixtureName);
  const store = new FactStore();

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        const relativePath = path.relative(fixtureDir, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8');

        for (const extractor of extractors) {
          const matches = extractor.supportedFiles.some(
            f => entry.name === f || entry.name.endsWith(f) || fileMatchesPattern(relativePath, f)
          );
          if (matches) {
            const result = extractor.extract(relativePath, content);
            for (const fact of result.facts) {
              store.addFact(fact);
            }
          }
        }
      }
    }
  }

  scanDir(fixtureDir);

  const groups = store.getFactGroups();
  const contradictions = engine.analyze(groups);

  return { facts: store.getAllFacts(), groups, contradictions };
}

describe('Integration: clean-node fixture', () => {
  it('should find zero contradictions', () => {
    const { contradictions } = scanFixture('clean-node');
    expect(contradictions).toHaveLength(0);
  });

  it('should extract facts from .nvmrc, package.json, Dockerfile, docker-compose, README', () => {
    const { facts } = scanFixture('clean-node');
    expect(facts.length).toBeGreaterThan(0);

    const categories = new Set(facts.map(f => f.category));
    expect(categories.has('runtime')).toBe(true);
    expect(categories.has('port')).toBe(true);
  });
});

describe('Integration: node-conflict fixture', () => {
  it('should detect node version mismatch (RUN001 or RUN002)', () => {
    const { contradictions } = scanFixture('node-conflict');
    const nodeMismatches = contradictions.filter(c =>
      c.category === 'runtime' && c.technology === 'node'
    );
    expect(nodeMismatches.length).toBeGreaterThanOrEqual(1);
    expect(nodeMismatches[0].ruleId).toMatch(/^RUN00[12]$/);
  });

  it('CI vs local disagreement should be critical severity', () => {
    const { contradictions } = scanFixture('node-conflict');
    const nodeMismatches = contradictions.filter(c =>
      c.category === 'runtime' && c.technology === 'node'
    );
    expect(nodeMismatches[0].severity).toBe('critical');
  });

  it('all contradictions should have explanations', () => {
    const { contradictions } = scanFixture('node-conflict');
    for (const c of contradictions) {
      expect(c.explanation).toBeDefined();
      expect(c.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe('Integration: docker-conflict fixture', () => {
  it('should detect port mismatch (CFG001 or CFG002)', () => {
    const { contradictions } = scanFixture('docker-conflict');
    const portMismatches = contradictions.filter(c =>
      c.category === 'port'
    );
    expect(portMismatches.length).toBeGreaterThanOrEqual(1);
    expect(portMismatches[0].ruleId).toMatch(/^CFG00[12]$/);
  });
});

describe('Integration: env-conflict fixture', () => {
  it('should detect env var mismatch (ENV001 or ENV002)', () => {
    const { contradictions } = scanFixture('env-conflict');
    const envMismatches = contradictions.filter(c =>
      c.category === 'environment'
    );
    expect(envMismatches.length).toBeGreaterThanOrEqual(1);
    expect(envMismatches[0].ruleId).toMatch(/^ENV00[12]$/);
  });

  it('should mention the missing variables in description', () => {
    const { contradictions } = scanFixture('env-conflict');
    const envMismatches = contradictions.filter(c =>
      c.category === 'environment'
    );
    const descriptions = envMismatches.map(c => c.description).join(' ');
    expect(descriptions).toContain('REDIS_URL');
  });
});

describe('Integration: doc-conflict fixture', () => {
  it('should detect invalid script reference in README (PKG002 or DOC001)', () => {
    const { contradictions } = scanFixture('doc-conflict');
    const scriptMismatches = contradictions.filter(c =>
      c.category === 'script'
    );
    // README references `npm run test` but package.json only has dev/build/start
    expect(scriptMismatches.length).toBeGreaterThanOrEqual(1);
  });

  it('should have critical severity for broken documentation', () => {
    const { contradictions } = scanFixture('doc-conflict');
    const scriptMismatches = contradictions.filter(c =>
      c.category === 'script'
    );
    expect(scriptMismatches[0].severity).toBe('critical');
  });
});

describe('Integration: intentional-diffs fixture', () => {
  it('detects version mismatches (known false positives documented)', () => {
    const { contradictions } = scanFixture('intentional-diffs');
    // Multi-stage FROM and engines.range vs exact will fire
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it('every contradiction has a stable ruleId', () => {
    const { contradictions } = scanFixture('intentional-diffs');
    for (const c of contradictions) {
      expect(c.ruleId).toMatch(/^[A-Z]+\d{3}$/);
    }
  });
});

describe('Integration: all fixtures produce valid contradictions', () => {
  const fixtures = [
    'clean-node',
    'node-conflict',
    'docker-conflict',
    'env-conflict',
    'doc-conflict',
    'intentional-diffs',
  ];

  for (const fixture of fixtures) {
    it(`${fixture}: contradictions have required fields`, () => {
      const { contradictions } = scanFixture(fixture);
      for (const c of contradictions) {
        expect(c.id).toBeDefined();
        expect(c.ruleId).toBeDefined();
        expect(c.severity).toBeDefined();
        expect(c.title).toBeDefined();
        expect(c.description).toBeDefined();
        expect(c.explanation).toBeDefined();
        expect(c.sources.length).toBeGreaterThan(0);
        expect(c.score).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
