import { FactStore } from '../engine/factStore';

describe('FactStore', () => {
  let store: FactStore;

  beforeEach(() => {
    store = new FactStore();
  });

  it('adds facts with generated IDs', () => {
    const fact = store.addFact({
      category: 'runtime',
      technology: 'node',
      value: '22',
      source: { file: '.nvmrc', line: 1 },
      confidence: 'high',
      authority: 95,
    });
    expect(fact.id).toBeDefined();
    expect(fact.id.length).toBeGreaterThan(0);
    expect(store.size).toBe(1);
  });

  it('adds multiple facts', () => {
    store.addFacts([
      { category: 'runtime', technology: 'node', value: '22', source: { file: '.nvmrc', line: 1 }, confidence: 'high', authority: 95 },
      { category: 'runtime', technology: 'node', value: '20', source: { file: 'Dockerfile', line: 1 }, confidence: 'high', authority: 85 },
    ]);
    expect(store.size).toBe(2);
  });

  it('groups facts by category and technology', () => {
    store.addFacts([
      { category: 'runtime', technology: 'node', value: '22', source: { file: '.nvmrc', line: 1 }, confidence: 'high', authority: 95 },
      { category: 'runtime', technology: 'node', value: '20', source: { file: 'Dockerfile', line: 1 }, confidence: 'high', authority: 85 },
      { category: 'port', technology: 'docker', value: '3000', source: { file: 'Dockerfile', line: 5 }, confidence: 'high', authority: 85 },
    ]);

    const groups = store.getFactGroups();
    expect(groups).toHaveLength(2);
    expect(groups[0].technology).toBe('node');
    expect(groups[0].facts).toHaveLength(2);
    expect(groups[1].technology).toBe('docker');
    expect(groups[1].facts).toHaveLength(1);
  });

  it('filters by category', () => {
    store.addFacts([
      { category: 'runtime', technology: 'node', value: '22', source: { file: '.nvmrc', line: 1 }, confidence: 'high', authority: 95 },
      { category: 'port', technology: 'docker', value: '3000', source: { file: 'Dockerfile', line: 5 }, confidence: 'high', authority: 85 },
    ]);

    const runtimeFacts = store.getFactsByCategory('runtime');
    expect(runtimeFacts).toHaveLength(1);
    expect(runtimeFacts[0].technology).toBe('node');
  });

  it('filters by technology', () => {
    store.addFacts([
      { category: 'runtime', technology: 'node', value: '22', source: { file: '.nvmrc', line: 1 }, confidence: 'high', authority: 95 },
      { category: 'runtime', technology: 'python', value: '3.12', source: { file: '.python-version', line: 1 }, confidence: 'high', authority: 95 },
    ]);

    const nodeFacts = store.getFactsByTechnology('node');
    expect(nodeFacts).toHaveLength(1);
  });

  it('clears all facts', () => {
    store.addFact({
      category: 'runtime', technology: 'node', value: '22',
      source: { file: '.nvmrc', line: 1 }, confidence: 'high', authority: 95,
    });
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
  });

  it('returns all facts', () => {
    store.addFacts([
      { category: 'runtime', technology: 'node', value: '22', source: { file: '.nvmrc', line: 1 }, confidence: 'high', authority: 95 },
      { category: 'port', technology: 'docker', value: '3000', source: { file: 'Dockerfile', line: 5 }, confidence: 'high', authority: 85 },
    ]);

    const all = store.getAllFacts();
    expect(all).toHaveLength(2);
  });
});
