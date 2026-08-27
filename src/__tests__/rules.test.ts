import { rules, crossGroupRules } from '../rules';
import { FactGroup, FactWithoutId } from '../types';

function makeFact(overrides: Partial<FactWithoutId>): FactWithoutId {
  return {
    category: 'runtime',
    technology: 'node',
    value: '22',
    source: { file: 'test', line: 1 },
    confidence: 'high',
    authority: 90,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<FactGroup>, facts: FactWithoutId[]): FactGroup {
  return {
    category: 'runtime',
    technology: 'node',
    facts: facts.map((f, i) => ({ ...f, id: `fact-${i}` })),
    ...overrides,
  };
}

describe('Rules', () => {
  describe('VersionMismatchRule (RUN001)', () => {
    const rule = rules.find(r => r.id === 'RUN001')!;

    it('matches runtime groups', () => {
      expect(rule.matches(makeGroup({ category: 'runtime', technology: 'python' }, []))).toBe(true);
    });

    it('does not match node runtime groups', () => {
      expect(rule.matches(makeGroup({ category: 'runtime', technology: 'node' }, []))).toBe(false);
    });

    it('does not match port groups', () => {
      expect(rule.matches(makeGroup({ category: 'port', technology: 'port' }, []))).toBe(false);
    });

    it('returns null for single fact', () => {
      const group = makeGroup({ technology: 'python' }, [makeFact({ technology: 'python', value: '3.12' })]);
      expect(rule.find(group)).toBeNull();
    });

    it('returns null when facts agree', () => {
      const group = makeGroup({ technology: 'python' }, [
        makeFact({ technology: 'python', value: '3.12', source: { file: '.python-version', line: 1 } }),
        makeFact({ technology: 'python', value: '3.12', source: { file: 'Dockerfile', line: 1 } }),
      ]);
      expect(rule.find(group)).toBeNull();
    });

    it('detects mismatch', () => {
      const group = makeGroup({ technology: 'python' }, [
        makeFact({ technology: 'python', value: '3.12', source: { file: '.python-version', line: 1 } }),
        makeFact({ technology: 'python', value: '3.9', source: { file: 'Dockerfile', line: 1 } }),
      ]);
      const contradiction = rule.find(group);
      expect(contradiction).not.toBeNull();
      expect(contradiction!.severity).toBe('warning');
      expect(contradiction!.ruleId).toBe('RUN001');
    });

    it('returns critical when CI disagrees', () => {
      const group = makeGroup({ technology: 'python' }, [
        makeFact({ technology: 'python', value: '3.12', source: { file: '.python-version', line: 1 } }),
        makeFact({ technology: 'python', value: '3.9', source: { file: '.github/workflows/ci.yml', line: 1 }, metadata: { ci: 'github-actions' } }),
      ]);
      const contradiction = rule.find(group);
      expect(contradiction!.severity).toBe('critical');
    });
  });

  describe('ScriptMismatchRule (PKG002)', () => {
    const rule = rules.find(r => r.id === 'PKG002')!;

    it('matches script groups', () => {
      expect(rule.matches(makeGroup({ category: 'script', technology: 'npm' }, []))).toBe(true);
    });

    it('returns null when no README scripts', () => {
      const group = makeGroup({ category: 'script', technology: 'npm' }, [
        makeFact({ category: 'script', technology: 'npm', value: 'dev: next dev', metadata: { scriptName: 'dev', scriptCommand: 'next dev' } }),
      ]);
      expect(rule.find(group)).toBeNull();
    });
  });

  describe('PortMismatchRule (CFG001)', () => {
    const rule = rules.find(r => r.id === 'CFG001')!;

    it('matches port groups', () => {
      expect(rule.matches(makeGroup({ category: 'port', technology: 'port' }, []))).toBe(true);
    });

    it('detects port mismatch', () => {
      const group = makeGroup({ category: 'port', technology: 'port' }, [
        makeFact({ category: 'port', technology: 'docker', value: '3000', source: { file: 'Dockerfile', line: 5 } }),
        makeFact({ category: 'port', technology: 'documentation', value: '8080', source: { file: 'README.md', line: 10 } }),
      ]);
      const contradiction = rule.find(group);
      expect(contradiction).not.toBeNull();
      expect(contradiction!.severity).toBe('warning');
      expect(contradiction!.ruleId).toBe('CFG001');
    });
  });

  describe('EnvironmentCompletenessRule (ENV002, cross-group)', () => {
    const rule = crossGroupRules.find(r => r.id === 'ENV002')!;

    it('detects missing env var', () => {
      const groups: FactGroup[] = [
        makeGroup({ category: 'environment', technology: 'DATABASE_URL' }, [
          makeFact({ category: 'environment', technology: 'DATABASE_URL', value: 'postgres://localhost', source: { file: '.env', line: 1 }, metadata: { envType: 'base' } }),
          makeFact({ category: 'environment', technology: 'DATABASE_URL', value: 'postgres://localhost', source: { file: '.env.example', line: 1 }, metadata: { envType: 'example' } }),
        ]),
        makeGroup({ category: 'environment', technology: 'REDIS_URL' }, [
          makeFact({ category: 'environment', technology: 'REDIS_URL', value: 'redis://localhost', source: { file: '.env.example', line: 2 }, metadata: { envType: 'example' } }),
        ]),
      ];

      const contradictions = rule.analyze(groups);
      expect(contradictions).toHaveLength(1);
      expect(contradictions[0].description).toContain('REDIS_URL');
      expect(contradictions[0].ruleId).toBe('ENV002');
    });

    it('returns empty when env vars match', () => {
      const groups: FactGroup[] = [
        makeGroup({ category: 'environment', technology: 'DATABASE_URL' }, [
          makeFact({ category: 'environment', technology: 'DATABASE_URL', value: 'postgres://localhost', source: { file: '.env', line: 1 }, metadata: { envType: 'base' } }),
          makeFact({ category: 'environment', technology: 'DATABASE_URL', value: 'postgres://localhost', source: { file: '.env.example', line: 1 }, metadata: { envType: 'example' } }),
        ]),
      ];

      const contradictions = rule.analyze(groups);
      expect(contradictions).toHaveLength(0);
    });
  });
});
