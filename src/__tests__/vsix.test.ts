import * as fs from 'fs';
import * as path from 'path';
import * as unzipper from 'unzipper';

const VSIX_PATH = path.resolve(__dirname, '../../envlint-0.1.0.vsix');

describe('VSIX smoke test', () => {
  let vsixBuffer: Buffer;
  let entries: Map<string, Buffer>;

  beforeAll(async () => {
    if (!fs.existsSync(VSIX_PATH)) {
      const { execSync } = require('child_process');
      execSync('npx @vscode/vsce package --allow-missing-repository', {
        cwd: path.resolve(__dirname, '../..'),
      });
    }

    vsixBuffer = fs.readFileSync(VSIX_PATH);
    entries = new Map();

    const zip = await unzipper.Open.buffer(vsixBuffer);
    for (const file of zip.files) {
      if (file.type === 'Directory') continue;
      const buffer = await file.buffer();
      entries.set(file.path, buffer);
    }
  });

  it('VSIX file exists', () => {
    expect(fs.existsSync(VSIX_PATH)).toBe(true);
  });

  it('VSIX is a valid ZIP file', () => {
    expect(vsixBuffer.length).toBeGreaterThan(0);
    expect(vsixBuffer[0]).toBe(0x50);
    expect(vsixBuffer[1]).toBe(0x4B);
  });

  it('contains package.json', () => {
    expect(entries.has('extension/package.json')).toBe(true);
    const pkg = JSON.parse(entries.get('extension/package.json')!.toString());
    expect(pkg.name).toBe('envlint');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.publisher).toBeDefined();
  });

  it('package.json has correct activationEvents', () => {
    const pkg = JSON.parse(entries.get('extension/package.json')!.toString());
    expect(pkg.activationEvents).toContain('onStartupFinished');
  });

  it('package.json has contributes.commands', () => {
    const pkg = JSON.parse(entries.get('extension/package.json')!.toString());
    expect(pkg.contributes.commands).toBeDefined();
    expect(pkg.contributes.commands.length).toBeGreaterThan(0);
    const commandIds = pkg.contributes.commands.map((c: any) => c.command);
    expect(commandIds).toContain('envlint.scan');
    expect(commandIds).toContain('envlint.refresh');
  });

  it('package.json has contributes.views', () => {
    const pkg = JSON.parse(entries.get('extension/package.json')!.toString());
    expect(pkg.contributes.views).toBeDefined();
    expect(pkg.contributes.views.envlint).toBeDefined();
    const treeViews = pkg.contributes.views.envlint.map((v: any) => v.id);
    expect(treeViews).toContain('envlint.treeview');
  });

  it('package.json has contributes.configuration', () => {
    const pkg = JSON.parse(entries.get('extension/package.json')!.toString());
    expect(pkg.contributes.configuration).toBeDefined();
    expect(pkg.contributes.configuration.properties).toBeDefined();
    const props = pkg.contributes.configuration.properties;
    expect(props['envlint.enabled']).toBeDefined();
    expect(props['envlint.excludePaths']).toBeDefined();
    expect(props['envlint.ignoreRules']).toBeDefined();
    expect(props['envlint.severityOverrides']).toBeDefined();
    expect(props['envlint.enableAuthorityScoring']).toBeDefined();
  });

  it('contains extension.js (compiled)', () => {
    expect(entries.has('extension/out/extension.js')).toBe(true);
    const js = entries.get('extension/out/extension.js')!.toString();
    expect(js).toContain('activate');
    expect(js).toContain('deactivate');
  });

  it('contains all engine modules', () => {
    expect(entries.has('extension/out/engine/factStore.js')).toBe(true);
    expect(entries.has('extension/out/engine/contradictionEngine.js')).toBe(true);
    expect(entries.has('extension/out/engine/extractors/index.js')).toBe(true);
  });

  it('contains rules', () => {
    expect(entries.has('extension/out/rules/index.js')).toBe(true);
    const rules = entries.get('extension/out/rules/index.js')!.toString();
    expect(rules).toContain('RUN001');
    expect(rules).toContain('RUN002');
    expect(rules).toContain('CFG001');
    expect(rules).toContain('CFG002');
    expect(rules).toContain('ENV001');
    expect(rules).toContain('ENV002');
    expect(rules).toContain('PKG001');
    expect(rules).toContain('PKG002');
    expect(rules).toContain('DOC001');
  });

  it('contains UI modules', () => {
    expect(entries.has('extension/out/ui/treeProvider.js')).toBe(true);
  });

  it('contains README', () => {
    expect(entries.has('extension/readme.md')).toBe(true);
    const readme = entries.get('extension/readme.md')!.toString();
    expect(readme).toContain('envlint');
    expect(readme).toContain('Installation');
  });

  it('contains LICENSE', () => {
    expect(entries.has('extension/LICENSE.txt')).toBe(true);
  });

  it('contains CHANGELOG', () => {
    expect(entries.has('extension/changelog.md')).toBe(true);
  });

  it('does NOT contain source TypeScript', () => {
    const hasTs = Array.from(entries.keys()).some(k => k.endsWith('.ts') && !k.endsWith('.d.ts'));
    expect(hasTs).toBe(false);
  });

  it('does NOT contain test files', () => {
    const hasTests = Array.from(entries.keys()).some(k => k.includes('__tests__'));
    expect(hasTests).toBe(false);
  });

  it('does NOT contain fixtures', () => {
    const hasFixtures = Array.from(entries.keys()).some(k => k.includes('fixtures'));
    expect(hasFixtures).toBe(false);
  });

  it('VSIX size is reasonable (<500KB)', () => {
    const sizeKB = vsixBuffer.length / 1024;
    console.log(`VSIX size: ${sizeKB.toFixed(1)}KB`);
    expect(sizeKB).toBeLessThan(500);
  });

  it('contains extension manifest', () => {
    expect(entries.has('extension.vsixmanifest')).toBe(true);
    const manifest = entries.get('extension.vsixmanifest')!.toString();
    expect(manifest).toContain('envlint');
  });
});
