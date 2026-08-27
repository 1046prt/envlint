import * as fs from 'fs';
import * as path from 'path';
import { extractors } from '../engine/extractors';
import { FactStore } from '../engine/factStore';
import { ContradictionEngine } from '../engine/contradictionEngine';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

const engine = new ContradictionEngine();
const TEMP_DIR = path.resolve(__dirname, '../../.perf-test-' + process.pid);

function cleanup() {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch {
      // Windows may lock files briefly — retry after delay
      try {
        rmSync(TEMP_DIR, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    }
  }
}

function generateFiles(count: number): string[] {
  cleanup();
  mkdirSync(TEMP_DIR, { recursive: true });
  const files: string[] = [];

  const fileTypes: Array<{ name: string; content: () => string }> = [
    { name: 'package.json', content: () => JSON.stringify({ name: 'test', engines: { node: '22' }, scripts: { dev: 'next dev', build: 'next build', start: 'next start' }, dependencies: { next: '14.0.0', react: '18.2.0' } }) },
    { name: '.nvmrc', content: () => '22' },
    { name: 'Dockerfile', content: () => 'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]' },
    { name: 'docker-compose.yml', content: () => 'services:\n  app:\n    build: .\n    ports:\n      - "3000:3000"' },
    { name: '.env', content: () => 'DATABASE_URL=postgres://localhost\nREDIS_URL=redis://localhost\nPORT=3000' },
    { name: '.env.example', content: () => 'DATABASE_URL=\nREDIS_URL=\nPORT=3000' },
    { name: 'README.md', content: () => '# App\n\n## Setup\n\n```bash\nnpm install\nnpm run dev\n```\n\nVisit http://localhost:3000' },
    { name: '.github/workflows/ci.yml', content: () => 'name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22' },
    { name: '.tool-versions', content: () => 'nodejs 22.0.0\npython 3.12.1' },
    { name: '.python-version', content: () => '3.12.1' },
  ];

  for (let i = 0; i < count; i++) {
    const ft = fileTypes[i % fileTypes.length];
    const subdir = Math.floor(i / fileTypes.length);
    const dir = subdir > 0 ? path.join(TEMP_DIR, `pkg-${subdir}`) : TEMP_DIR;
    mkdirSync(dir, { recursive: true });

    // For nested paths like .github/workflows/ci.yml, create the full directory
    const fileDir = path.dirname(path.join(dir, ft.name));
    mkdirSync(fileDir, { recursive: true });

    const filePath = path.join(dir, ft.name);
    writeFileSync(filePath, ft.content(), 'utf-8');
    files.push(filePath);
  }

  return files;
}

function scanFiles(files: string[]): { facts: number; contradictions: number; duration: number } {
  const store = new FactStore();
  const start = performance.now();

  for (const filePath of files) {
    const relativePath = path.relative(TEMP_DIR, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const extractor of extractors) {
      const matches = extractor.supportedFiles.some(
        f => relativePath === f || relativePath.endsWith(f)
      );
      if (matches) {
        const result = extractor.extract(filePath, content);
        if (result && Array.isArray(result.facts)) {
          store.addFacts(result.facts);
        }
      }
    }
  }

  const groups = store.getFactGroups();
  const contradictions = engine.analyze(groups);
  const duration = performance.now() - start;

  return { facts: store.size, contradictions: contradictions.length, duration };
}

describe('Performance benchmarks', () => {
  afterAll(() => cleanup());

  it('scans 100 files in <500ms', () => {
    const files = generateFiles(100);
    const result = scanFiles(files);
    console.log(`100 files: ${result.duration.toFixed(0)}ms, ${result.facts} facts, ${result.contradictions} contradictions`);
    expect(result.duration).toBeLessThan(500);
  });

  it('scans 500 files in <2000ms', () => {
    const files = generateFiles(500);
    const result = scanFiles(files);
    console.log(`500 files: ${result.duration.toFixed(0)}ms, ${result.facts} facts, ${result.contradictions} contradictions`);
    expect(result.duration).toBeLessThan(2000);
  });

  it('scans 1000 files in <4000ms', () => {
    const files = generateFiles(1000);
    const result = scanFiles(files);
    console.log(`1000 files: ${result.duration.toFixed(0)}ms, ${result.facts} facts, ${result.contradictions} contradictions`);
    expect(result.duration).toBeLessThan(4000);
  });

  it('scans 2000 files in <8000ms', () => {
    const files = generateFiles(2000);
    const result = scanFiles(files);
    console.log(`2000 files: ${result.duration.toFixed(0)}ms, ${result.facts} facts, ${result.contradictions} contradictions`);
    expect(result.duration).toBeLessThan(8000);
  });

  it('memory stays under 50MB for 2000 files', () => {
    const files = generateFiles(2000);
    const before = process.memoryUsage().heapUsed;
    scanFiles(files);
    const after = process.memoryUsage().heapUsed;
    const deltaMB = (after - before) / 1024 / 1024;
    console.log(`Memory delta: ${deltaMB.toFixed(1)}MB for 2000 files`);
    expect(deltaMB).toBeLessThan(50);
    cleanup();
  });
});
