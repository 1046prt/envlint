import { ContradictionEngine } from '../engine/contradictionEngine';
import { FactStore } from '../engine/factStore';

const engine = new ContradictionEngine();

describe('False Positive Prevention', () => {
  describe('Consistent project — zero contradictions', () => {
    it('should find zero contradictions when all sources agree', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: '.nvmrc', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: 'Dockerfile', line: 1 },
          confidence: 'high',
          authority: 85,
          metadata: { dockerImage: 'node:22-alpine' },
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: '.github/workflows/ci.yml', line: 10 },
          confidence: 'high',
          authority: 85,
          metadata: { ci: 'github-actions' },
        },
        {
          category: 'port',
          technology: 'docker',
          value: '3000',
          source: { file: 'Dockerfile', line: 3 },
          confidence: 'high',
          authority: 85,
          metadata: { instruction: 'EXPOSE' },
        },
        {
          category: 'port',
          technology: 'docker-compose',
          value: '3000',
          source: { file: 'docker-compose.yml', line: 5 },
          confidence: 'high',
          authority: 85,
          metadata: { hostPort: '3000', containerPort: '3000' },
        },
        {
          category: 'port',
          technology: 'documentation',
          value: '3000',
          source: { file: 'README.md', line: 20 },
          confidence: 'low',
          authority: 40,
          metadata: { url: 'http://localhost:3000' },
        },
        {
          category: 'environment',
          technology: 'DATABASE_URL',
          value: 'postgres://localhost',
          source: { file: '.env', line: 1 },
          confidence: 'high',
          authority: 75,
          metadata: { envType: 'base' },
        },
        {
          category: 'environment',
          technology: 'DATABASE_URL',
          value: 'postgres://localhost',
          source: { file: '.env.example', line: 1 },
          confidence: 'medium',
          authority: 80,
          metadata: { envType: 'example' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);
      expect(contradictions).toHaveLength(0);
    });
  });

  describe('All contradictions have stable ruleId', () => {
    it('every contradiction should have a ruleId matching [A-Z]+\\d{3}', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: '.nvmrc', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '18',
          source: { file: 'Dockerfile', line: 1 },
          confidence: 'high',
          authority: 85,
          metadata: { dockerImage: 'node:18' },
        },
        {
          category: 'port',
          technology: 'docker',
          value: '3000',
          source: { file: 'Dockerfile', line: 3 },
          confidence: 'high',
          authority: 85,
        },
        {
          category: 'port',
          technology: 'documentation',
          value: '8080',
          source: { file: 'README.md', line: 10 },
          confidence: 'low',
          authority: 40,
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      expect(contradictions.length).toBeGreaterThan(0);
      for (const c of contradictions) {
        expect(c.ruleId).toBeDefined();
        expect(c.ruleId).toMatch(/^[A-Z]+\d{3}$/);
      }
    });
  });

  describe('Known false positive: engines.node range vs exact .nvmrc', () => {
    it('fires because >=18 !== 22 string comparison (should be fixed)', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'node',
          value: '>=18',
          source: { file: 'package.json', line: 0 },
          confidence: 'medium',
          authority: 90,
          metadata: { field: 'engines.node' },
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: '.nvmrc', line: 1 },
          confidence: 'high',
          authority: 95,
          metadata: { runtimeFile: '.nvmrc', rawVersion: '22' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      const nodeMismatches = contradictions.filter(c =>
        c.category === 'runtime' && c.technology === 'node'
      );

      // Known false positive: `>=18` !== `22` as strings.
      // Fix: parse semver ranges and check if exact version satisfies the range.
      expect(nodeMismatches.length).toBe(1);
    });
  });

  describe('Known false positive: Docker multi-stage FROM lines', () => {
    it('fires because both FROM lines become facts in same group', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: 'Dockerfile', line: 1 },
          confidence: 'high',
          authority: 85,
          metadata: { dockerImage: 'node:22-alpine', instruction: 'FROM' },
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '18-slim',
          source: { file: 'Dockerfile', line: 5 },
          confidence: 'high',
          authority: 85,
          metadata: { dockerImage: 'node:18-slim', instruction: 'FROM' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      const nodeMismatches = contradictions.filter(c =>
        c.category === 'runtime' && c.technology === 'node'
      );

      // Known false positive: multi-stage builds intentionally use different versions.
      // Fix: detect multi-stage Dockerfiles and treat each FROM as a separate context.
      expect(nodeMismatches.length).toBe(1);
    });
  });

  describe('Known false positive: README recommends lower version', () => {
    it('fires because documentation fact disagrees with .nvmrc', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: '.nvmrc', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '18',
          source: { file: 'README.md', line: 10 },
          confidence: 'low',
          authority: 40,
          metadata: { context: 'Requires Node.js 18 or later' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      const nodeMismatches = contradictions.filter(c =>
        c.category === 'runtime' && c.technology === 'node'
      );

      // Known false positive: README is a minimum requirement, not exact version.
      // Fix: when one source is low-authority documentation, suppress or downgrade.
      expect(nodeMismatches.length).toBe(1);
    });
  });

  describe('Known false positive: .env.example has extra vars by design', () => {
    it('fires because cross-group rule finds vars in example but not in .env', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'environment',
          technology: 'DATABASE_URL',
          value: 'postgres://localhost',
          source: { file: '.env', line: 1 },
          confidence: 'high',
          authority: 75,
          metadata: { envType: 'base' },
        },
        {
          category: 'environment',
          technology: 'DATABASE_URL',
          value: 'postgres://localhost',
          source: { file: '.env.example', line: 1 },
          confidence: 'medium',
          authority: 80,
          metadata: { envType: 'example' },
        },
        {
          category: 'environment',
          technology: 'REDIS_URL',
          value: 'redis://localhost:6379',
          source: { file: '.env.example', line: 2 },
          confidence: 'medium',
          authority: 80,
          metadata: { envType: 'example' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      const envMismatches = contradictions.filter(c =>
        c.category === 'environment'
      );

      // Known false positive: extra vars in .env.example are intentional templates.
      // Fix: only flag when .env is missing a var that .env.example marks as required.
      expect(envMismatches.length).toBe(1);
      expect(envMismatches[0].ruleId).toBe('ENV002');
    });
  });

  describe('Known limitation: package manager mismatch not detected across groups', () => {
    it('does NOT fire because FactStore groups by technology separately', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'package_manager',
          technology: 'pnpm',
          value: '8.0.0',
          source: { file: 'package.json', line: 0 },
          confidence: 'high',
          authority: 90,
          metadata: { field: 'packageManager' },
        },
        {
          category: 'package_manager',
          technology: 'npm',
          value: 'install',
          source: { file: 'README.md', line: 15 },
          confidence: 'low',
          authority: 40,
          metadata: { command: 'npm install' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      const pkgMismatches = contradictions.filter(c =>
        c.category === 'package_manager'
      );

      // Known limitation: pnpm and npm are in separate groups, so PKG001 never fires.
      // Fix: PKG001 should be a cross-group rule, or FactStore should group by category only.
      expect(pkgMismatches.length).toBe(0);
    });
  });

  describe('CI vs local node version mismatch is critical', () => {
    it('should detect and severity=critical when CI disagrees with local', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'node',
          value: '22',
          source: { file: '.nvmrc', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'node',
          value: '20',
          source: { file: '.github/workflows/ci.yml', line: 10 },
          confidence: 'high',
          authority: 85,
          metadata: { ci: 'github-actions' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      const nodeMismatches = contradictions.filter(c =>
        c.category === 'runtime' && c.technology === 'node'
      );

      expect(nodeMismatches.length).toBe(1);
      expect(nodeMismatches[0].severity).toBe('critical');
    });
  });

  describe('Scoring', () => {
    it('scores contradictions above zero', () => {
      const store = new FactStore();
      store.addFacts([
        {
          category: 'runtime',
          technology: 'python',
          value: '3.11',
          source: { file: '.python-version', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'python',
          value: '3.9',
          source: { file: 'Dockerfile', line: 1 },
          confidence: 'high',
          authority: 85,
          metadata: { dockerImage: 'python:3.9' },
        },
      ]);

      const groups = store.getFactGroups();
      const contradictions = engine.analyze(groups);

      expect(contradictions.length).toBe(1);
      expect(contradictions[0].score).toBeGreaterThan(0);
    });

    it('known limitation: authority spread does not yet differentiate scores', () => {
      // Both cases produce the same score because:
      // 1. confidence calc is identical (both have .python-version → same boost)
      // 2. authority spread bonus requires avgAuthority > 70, which the low-auth case doesn't meet
      // Fix: add penalty for low-authority sources and reward high-authority-only disagreement
      const storeHigh = new FactStore();
      storeHigh.addFacts([
        {
          category: 'runtime',
          technology: 'python',
          value: '3.11',
          source: { file: '.python-version', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'python',
          value: '3.9',
          source: { file: 'Dockerfile', line: 1 },
          confidence: 'high',
          authority: 85,
          metadata: { dockerImage: 'python:3.9' },
        },
      ]);

      const storeLow = new FactStore();
      storeLow.addFacts([
        {
          category: 'runtime',
          technology: 'python',
          value: '3.11',
          source: { file: '.python-version', line: 1 },
          confidence: 'high',
          authority: 95,
        },
        {
          category: 'runtime',
          technology: 'python',
          value: '3.9',
          source: { file: 'README.md', line: 10 },
          confidence: 'low',
          authority: 40,
          metadata: { context: 'Python 3.9 recommended' },
        },
      ]);

      const contradictionsHigh = engine.analyze(storeHigh.getFactGroups());
      const contradictionsLow = engine.analyze(storeLow.getFactGroups());

      // Currently both get the same score — known limitation
      expect(contradictionsHigh[0].score).toBe(contradictionsLow[0].score);
    });
  });
});
