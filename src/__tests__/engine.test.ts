import { ContradictionEngine } from '../engine/contradictionEngine';
import { FactStore } from '../engine/factStore';

describe('ContradictionEngine', () => {
  const engine = new ContradictionEngine();

  describe('enableAuthorityScoring', () => {
    it('applies authority scoring when enabled', () => {
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
      const withAuth = engine.analyze(groups, true);
      const withoutAuth = engine.analyze(groups, false);

      expect(withAuth.length).toBe(1);
      expect(withoutAuth.length).toBe(1);

      // Authority scoring adds +10 for high spread with high avg
      expect(withAuth[0].score).toBeGreaterThanOrEqual(withoutAuth[0].score);
    });

    it('skips authority scoring when disabled', () => {
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
        },
      ]);

      const groups = store.getFactGroups();
      const withoutAuth = engine.analyze(groups, false);

      // Score should equal confidence when authority scoring is off
      expect(withoutAuth[0].score).toBe(withoutAuth[0].confidence);
    });

    it('defaults to authority scoring enabled', () => {
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
        },
      ]);

      const groups = store.getFactGroups();
      const defaultResult = engine.analyze(groups);
      const explicitResult = engine.analyze(groups, true);

      expect(defaultResult[0].score).toBe(explicitResult[0].score);
    });
  });

  describe('calculateScore', () => {
    it('returns 100 for zero facts', () => {
      expect(engine.calculateScore([], 0)).toBe(100);
    });

    it('returns lower score for critical contradictions', () => {
      const contradictions = [{
        id: '1',
        ruleId: 'RUN002',
        severity: 'critical' as const,
        category: 'runtime' as const,
        technology: 'node',
        title: 'test',
        description: 'test',
        explanation: 'test',
        sources: [],
        confidence: 90,
        score: 90,
      }];

      const score = engine.calculateScore(contradictions, 10);
      expect(score).toBeLessThan(100);
    });

    it('penalizes more for higher scores', () => {
      const lowScore = [{
        id: '1',
        ruleId: 'RUN002',
        severity: 'critical' as const,
        category: 'runtime' as const,
        technology: 'node',
        title: 'test',
        description: 'test',
        explanation: 'test',
        sources: [],
        confidence: 50,
        score: 50,
      }];

      const highScore = [{
        id: '1',
        ruleId: 'RUN002',
        severity: 'critical' as const,
        category: 'runtime' as const,
        technology: 'node',
        title: 'test',
        description: 'test',
        explanation: 'test',
        sources: [],
        confidence: 95,
        score: 95,
      }];

      const scoreLow = engine.calculateScore(lowScore, 10);
      const scoreHigh = engine.calculateScore(highScore, 10);

      expect(scoreHigh).toBeLessThan(scoreLow);
    });

    it('never goes below 0', () => {
      const contradictions = Array(100).fill(null).map((_, i) => ({
        id: String(i),
        ruleId: 'RUN001',
        severity: 'critical' as const,
        category: 'runtime' as const,
        technology: 'node',
        title: 'test',
        description: 'test',
        explanation: 'test',
        sources: [],
        confidence: 99,
        score: 99,
      }));

      expect(engine.calculateScore(contradictions, 1)).toBe(0);
    });
  });
});
