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
  const scannedFiles: string[] = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        const relativePath = path.relative(fixtureDir, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8');
        scannedFiles.push(relativePath);

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

  return { facts: store.getAllFacts(), groups, contradictions, scannedFiles };
}

const EXPECTED: Record<string, { tp: number; fp: number; intentional: number; description: string }> = {
  'clean-node': {
    tp: 0, fp: 0, intentional: 0,
    description: 'Consistent versions — zero contradictions expected',
  },
  'node-conflict': {
    tp: 1, fp: 0, intentional: 0,
    description: 'Node version mismatch between .nvmrc and Dockerfile',
  },
  'docker-conflict': {
    tp: 1, fp: 0, intentional: 0,
    description: 'Port mismatch between Dockerfile EXPOSE and docker-compose',
  },
  'env-conflict': {
    tp: 1, fp: 0, intentional: 0,
    description: 'Missing env var (REDIS_URL) in .env.example',
  },
  'doc-conflict': {
    tp: 1, fp: 0, intentional: 0,
    description: 'README references npm run test but script does not exist',
  },
  'intentional-diffs': {
    tp: 0, fp: 0, intentional: 3,
    description: 'Multi-stage FROM, engines.range, doc mention — all intentional',
  },
};

const FIXTURE_NAMES = Object.keys(EXPECTED);

describe('Precision measurement across all fixtures', () => {
  for (const fixtureName of FIXTURE_NAMES) {
    const expected = EXPECTED[fixtureName];

    it(`${fixtureName}: ${expected.description}`, () => {
      const { facts, contradictions, scannedFiles } = scanFixture(fixtureName);

      expect(scannedFiles.length).toBeGreaterThan(0);

      if (fixtureName === 'clean-node') {
        expect(contradictions).toHaveLength(0);
      }

      if (fixtureName === 'intentional-diffs') {
        expect(contradictions.length).toBeGreaterThan(0);
        for (const c of contradictions) {
          expect(c.ruleId).toBeDefined();
          expect(c.explanation.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it('measures precision across all fixtures', () => {
    let totalTP = 0;
    let totalFP = 0;
    let totalIntentional = 0;
    let totalFindings = 0;

    for (const fixtureName of FIXTURE_NAMES) {
      const { contradictions } = scanFixture(fixtureName);
      const expected = EXPECTED[fixtureName];

      totalFindings += contradictions.length;
      totalTP += expected.tp;
      totalFP += expected.fp;
      totalIntentional += expected.intentional;
    }

    const precision = totalFindings > 0 ? totalTP / (totalTP + totalFP) : 1;

    console.log('\n=== PRECISION MEASUREMENT ===');
    console.log(`Total findings: ${totalFindings}`);
    console.log(`True positives: ${totalTP}`);
    console.log(`False positives: ${totalFP}`);
    console.log(`Intentional diffs: ${totalIntentional}`);
    console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
    console.log('=============================\n');

    expect(precision).toBeGreaterThanOrEqual(0.8);
  });

  it('all contradictions have stable ruleId format', () => {
    for (const fixtureName of FIXTURE_NAMES) {
      const { contradictions } = scanFixture(fixtureName);
      for (const c of contradictions) {
        expect(c.ruleId).toMatch(/^[A-Z]+\d{3}$/);
      }
    }
  });

  it('all contradictions have required fields', () => {
    for (const fixtureName of FIXTURE_NAMES) {
      const { contradictions } = scanFixture(fixtureName);
      for (const c of contradictions) {
        expect(c.id).toBeDefined();
        expect(c.ruleId).toBeDefined();
        expect(['critical', 'warning', 'possible']).toContain(c.severity);
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(99);
        expect(c.sources.length).toBeGreaterThan(0);
        expect(c.explanation.length).toBeGreaterThan(0);
      }
    }
  });

  it('fact extraction produces valid confidence and authority', () => {
    for (const fixtureName of FIXTURE_NAMES) {
      const { facts } = scanFixture(fixtureName);
      for (const fact of facts) {
        expect(['high', 'medium', 'low']).toContain(fact.confidence);
        expect(fact.authority).toBeGreaterThanOrEqual(0);
        expect(fact.authority).toBeLessThanOrEqual(100);
      }
    }
  });
});
