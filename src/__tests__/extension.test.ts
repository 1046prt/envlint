import { FactStore } from '../engine/factStore';
import { ContradictionEngine } from '../engine/contradictionEngine';
import { FactCategory } from '../types';

function makeFact(overrides: Partial<Parameters<FactStore['addFact']>[0]> = {}) {
  return {
    category: 'runtime' as FactCategory,
    technology: 'node',
    value: '22',
    source: { file: 'test', line: 1 },
    confidence: 'high' as const,
    authority: 90,
    ...overrides,
  };
}

describe('FactStore', () => {
  it('adds and retrieves facts', () => {
    const store = new FactStore();
    store.addFact(makeFact());
    expect(store.size).toBe(1);
    expect(store.getAllFacts()).toHaveLength(1);
  });

  it('adds multiple facts', () => {
    const store = new FactStore();
    store.addFacts([makeFact({ value: '22' }), makeFact({ value: '18' })]);
    expect(store.size).toBe(2);
  });

  it('groups by category and technology', () => {
    const store = new FactStore();
    store.addFacts([
      makeFact({ category: 'runtime', technology: 'node', value: '22' }),
      makeFact({ category: 'runtime', technology: 'node', value: '18' }),
      makeFact({ category: 'port', technology: 'docker', value: '3000' }),
    ]);

    const groups = store.getFactGroups();
    expect(groups).toHaveLength(2);
  });

  it('clears all facts', () => {
    const store = new FactStore();
    store.addFacts([makeFact(), makeFact()]);
    store.clear();
    expect(store.size).toBe(0);
  });

  it('filters by category', () => {
    const store = new FactStore();
    store.addFacts([
      makeFact({ category: 'runtime' }),
      makeFact({ category: 'port' }),
    ]);

    expect(store.getFactsByCategory('runtime')).toHaveLength(1);
    expect(store.getFactsByCategory('port')).toHaveLength(1);
  });

  it('filters by technology', () => {
    const store = new FactStore();
    store.addFacts([
      makeFact({ technology: 'node' }),
      makeFact({ technology: 'python' }),
    ]);

    expect(store.getFactsByTechnology('node')).toHaveLength(1);
    expect(store.getFactsByTechnology('python')).toHaveLength(1);
  });
});

describe('Path exclusion', () => {
  function shouldExclude(relativePath: string, excludePaths: string[]): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    for (const exclude of excludePaths) {
      const excluded = exclude.replace(/\\/g, '/');
      if (normalized.startsWith(excluded + '/') || normalized.includes('/' + excluded + '/')) {
        return true;
      }
    }
    return false;
  }

  it('excludes node_modules', () => {
    expect(shouldExclude('node_modules/package/index.js', ['node_modules'])).toBe(true);
  });

  it('excludes nested node_modules', () => {
    expect(shouldExclude('src/node_modules/pkg/index.js', ['node_modules'])).toBe(true);
  });

  it('does not exclude matching prefix without separator', () => {
    expect(shouldExclude('node_modules_ext/file.js', ['node_modules'])).toBe(false);
  });

  it('excludes dist', () => {
    expect(shouldExclude('dist/bundle.js', ['dist'])).toBe(true);
  });

  it('does not exclude unrelated paths', () => {
    expect(shouldExclude('src/index.ts', ['node_modules', 'dist'])).toBe(false);
  });

  it('handles Windows paths', () => {
    expect(shouldExclude('node_modules\\package\\index.js', ['node_modules'])).toBe(true);
  });
});

describe('Ignore rules', () => {
  function applyIgnoreRules(
    contradictions: any[],
    ignoreRules: any[]
  ): any[] {
    if (ignoreRules.length === 0) return contradictions;

    return contradictions.filter(c => {
      for (const rule of ignoreRules) {
        const matches = rule.rule === '*' ||
          rule.rule === c.ruleId ||
          rule.rule === `${c.category}.${c.technology}`;

        if (!matches) continue;

        if (!rule.files || rule.files.length === 0) return false;

        const allSourcesIgnored = c.sources.every((s: any) =>
          rule.files.some((pattern: string) => s.source.file === pattern)
        );

        if (allSourcesIgnored) return false;
      }
      return true;
    });
  }

  it('ignores all when rule is *', () => {
    const contradictions = [{ ruleId: 'RUN001', category: 'runtime', technology: 'node', sources: [] }];
    expect(applyIgnoreRules(contradictions, [{ rule: '*' }])).toHaveLength(0);
  });

  it('ignores by rule ID', () => {
    const contradictions = [
      { ruleId: 'RUN001', category: 'runtime', technology: 'node', sources: [] },
      { ruleId: 'CFG001', category: 'port', technology: 'port', sources: [] },
    ];
    expect(applyIgnoreRules(contradictions, [{ rule: 'RUN001' }])).toHaveLength(1);
  });

  it('ignores by category.technology', () => {
    const contradictions = [
      { ruleId: 'RUN001', category: 'runtime', technology: 'node', sources: [] },
      { ruleId: 'CFG001', category: 'port', technology: 'port', sources: [] },
    ];
    expect(applyIgnoreRules(contradictions, [{ rule: 'runtime.node' }])).toHaveLength(1);
  });

  it('ignores only matching files', () => {
    const contradictions = [{
      ruleId: 'RUN001',
      category: 'runtime',
      technology: 'node',
      sources: [{ source: { file: 'Dockerfile' } }],
    }];
    expect(applyIgnoreRules(contradictions, [{ rule: 'RUN001', files: ['Dockerfile'] }])).toHaveLength(0);
    expect(applyIgnoreRules(contradictions, [{ rule: 'RUN001', files: ['README.md'] }])).toHaveLength(1);
  });
});

describe('Severity overrides', () => {
  function applySeverityOverrides(
    contradictions: any[],
    overrides: Record<string, string>
  ): any[] {
    if (!overrides || Object.keys(overrides).length === 0) return contradictions;

    return contradictions.map(c => {
      const override = overrides[c.ruleId] || overrides[`${c.category}.${c.technology}`];
      if (override && override !== c.severity) {
        return { ...c, severity: override };
      }
      return c;
    });
  }

  it('overrides severity by rule ID', () => {
    const contradictions = [{ ruleId: 'RUN001', severity: 'warning' }];
    const result = applySeverityOverrides(contradictions, { RUN001: 'critical' });
    expect(result[0].severity).toBe('critical');
  });

  it('overrides severity by category.technology', () => {
    const contradictions = [{ ruleId: 'RUN001', severity: 'warning', category: 'runtime', technology: 'node' }];
    const result = applySeverityOverrides(contradictions, { 'runtime.node': 'critical' });
    expect(result[0].severity).toBe('critical');
  });

  it('does not override when no match', () => {
    const contradictions = [{ ruleId: 'RUN001', severity: 'warning' }];
    const result = applySeverityOverrides(contradictions, { CFG001: 'critical' });
    expect(result[0].severity).toBe('warning');
  });

  it('returns unchanged when no overrides', () => {
    const contradictions = [{ ruleId: 'RUN001', severity: 'warning' }];
    const result = applySeverityOverrides(contradictions, {});
    expect(result[0].severity).toBe('warning');
  });
});

describe('Binary detection', () => {
  function isBinaryContent(text: string): boolean {
    const sample = text.slice(0, 8192);
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (code === 0) return true;
    }
    return false;
  }

  it('detects null bytes as binary', () => {
    expect(isBinaryContent('\x00\x00\x00')).toBe(true);
  });

  it('allows normal text', () => {
    expect(isBinaryContent('hello world')).toBe(false);
  });

  it('allows empty string', () => {
    expect(isBinaryContent('')).toBe(false);
  });

  it('checks only first 8KB', () => {
    const text = 'a'.repeat(8192) + '\x00';
    expect(isBinaryContent(text)).toBe(false);
  });
});
