import * as vscode from 'vscode';
import { FactStore } from './engine/factStore';
import { ContradictionEngine } from './engine/contradictionEngine';
import { extractors } from './engine/extractors';
import { FactGroup, Contradiction, Severity, DEFAULT_CONFIG, EnvLintConfig, IgnoreRule } from './types';
import { EnvlintTreeProvider } from './ui/treeProvider';
import { minimatch } from 'minimatch';

const MAX_FILES = 5000;
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.lock', '.sum', '.wasm',
]);

let factStore: FactStore;
let engine: ContradictionEngine;
let diagnosticCollection: vscode.DiagnosticCollection;
let treeProvider: EnvlintTreeProvider;
let outputChannel: vscode.OutputChannel;
let config: EnvLintConfig;
let statusBarItem: vscode.StatusBarItem;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let scanVersion = 0;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('envlint');
  outputChannel.appendLine('envlint activating...');

  factStore = new FactStore();
  engine = new ContradictionEngine();
  diagnosticCollection = vscode.languages.createDiagnosticCollection('envlint');

  treeProvider = new EnvlintTreeProvider();
  vscode.window.registerTreeDataProvider('envlint.treeview', treeProvider);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBarItem.command = 'envlint.scan';
  context.subscriptions.push(statusBarItem);

  config = loadConfig();

  context.subscriptions.push(
    vscode.commands.registerCommand('envlint.scan', () => scanWorkspace()),
    vscode.commands.registerCommand('envlint.refresh', () => scanWorkspace())
  );

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  fileWatcher.onDidChange(() => debounceScan());
  fileWatcher.onDidCreate(() => debounceScan());
  fileWatcher.onDidDelete(() => debounceScan());
  context.subscriptions.push(fileWatcher);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('envlint')) {
        config = loadConfig();
        scanWorkspace();
      }
    })
  );

  // Show activation message after scan completes
  await scanWorkspace();
  outputChannel.appendLine('envlint activated.');
}

export function deactivate() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}

function debounceScan(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    scanWorkspace();
  }, 500);
}

function loadConfig(): EnvLintConfig {
  const vsConfig = vscode.workspace.getConfiguration('envlint');
  const rawIgnoreRules = vsConfig.get<unknown>('ignoreRules', DEFAULT_CONFIG.ignoreRules);

  let ignoreRules: IgnoreRule[];
  if (Array.isArray(rawIgnoreRules)) {
    ignoreRules = rawIgnoreRules.filter(
      (r): r is IgnoreRule =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as IgnoreRule).rule === 'string'
    );
  } else {
    ignoreRules = DEFAULT_CONFIG.ignoreRules;
  }

  return {
    enabled: vsConfig.get<boolean>('enabled', DEFAULT_CONFIG.enabled),
    excludePaths: vsConfig.get<string[]>('excludePaths', DEFAULT_CONFIG.excludePaths),
    ignoreRules,
    severityOverrides: vsConfig.get<Record<string, Severity>>('severityOverrides', DEFAULT_CONFIG.severityOverrides),
    enableAuthorityScoring: vsConfig.get<boolean>('enableAuthorityScoring', DEFAULT_CONFIG.enableAuthorityScoring),
  };
}

async function scanWorkspace(): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    outputChannel.appendLine('No workspace folder open. EnvLint requires a workspace.');
    return;
  }

  const currentVersion = ++scanVersion;
  factStore.clear();
  diagnosticCollection.clear();
  const scanErrors: string[] = [];

  for (const folder of workspaceFolders) {
    if (currentVersion !== scanVersion) return;
    await scanFolder(folder.uri, scanErrors, currentVersion);
  }

  if (currentVersion !== scanVersion) return;

  if (scanErrors.length > 0) {
    outputChannel.appendLine(`Scan errors:\n${scanErrors.join('\n')}`);
  }

  const groups = factStore.getFactGroups();
  const allContradictions = engine.analyze(groups, config.enableAuthorityScoring);
  const contradictions = applyIgnoreRules(allContradictions);
  const applied = applySeverityOverrides(contradictions);
  const score = engine.calculateScore(applied, factStore.size);

  updateDiagnostics(applied);
  treeProvider.update(groups, applied, score);
  updateStatusBar(score, applied);
}

async function scanFolder(
  folderUri: vscode.Uri,
  scanErrors: string[],
  currentVersion: number
): Promise<void> {
  const excludeGlob = config.excludePaths.map(p => `**/${p}/**`).join(',');
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folderUri, '**/*'),
    `{${excludeGlob || '**/node_modules/**'}}`
  );

  if (files.length > MAX_FILES) {
    outputChannel.appendLine(
      `Found ${files.length} files (limit: ${MAX_FILES}). Scanning first ${MAX_FILES} files.`
    );
    files.length = MAX_FILES;
  }

  for (const fileUri of files) {
    if (currentVersion !== scanVersion) return;

    const relativePath = vscode.workspace.asRelativePath(fileUri);

    if (shouldExcludePath(relativePath)) {
      continue;
    }

    const ext = relativePath.includes('.')
      ? '.' + relativePath.split('.').pop()?.toLowerCase()
      : '';
    if (ext && BINARY_EXTENSIONS.has(ext)) {
      continue;
    }

    const extractor = extractors.find(e =>
      e.supportedFiles.some((pattern: string) => {
        if (pattern.includes('*')) {
          const escaped = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
          const regex = new RegExp('^' + escaped + '$');
          return regex.test(relativePath);
        }
        return relativePath.endsWith(pattern) || relativePath === pattern;
      })
    );

    const absolutePath = fileUri.fsPath;

    if (extractor) {
      try {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const text = document.getText();

        if (isBinaryContent(text)) {
          continue;
        }

        const result = extractor.extract(absolutePath, text);
        if (result && Array.isArray(result.facts)) {
          factStore.addFacts(result.facts);
        }
        if (result && Array.isArray(result.errors)) {
          for (const err of result.errors) {
            scanErrors.push(err);
          }
        }
      } catch (e) {
        scanErrors.push(`Failed to read ${relativePath}: ${String(e)}`);
      }
    }
  }
}

function isBinaryContent(text: string): boolean {
  const sample = text.slice(0, 8192);
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
  }
  return false;
}

function shouldExcludePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  for (const exclude of config.excludePaths) {
    const excluded = exclude.replace(/\\/g, '/');
    if (normalized.startsWith(excluded + '/') || normalized.includes('/' + excluded + '/')) {
      return true;
    }
  }
  return false;
}

function applyIgnoreRules(contradictions: Contradiction[]): Contradiction[] {
  if (config.ignoreRules.length === 0) {
    return contradictions;
  }

  return contradictions.filter(c => {
    for (const rule of config.ignoreRules) {
      const matches = rule.rule === '*' ||
        rule.rule === c.ruleId ||
        rule.rule === `${c.category}.${c.technology}`;

      if (!matches) {
        continue;
      }

      if (!rule.files || rule.files.length === 0) {
        return false;
      }

      const allSourcesIgnored = c.sources.every(s =>
        rule.files!.some(pattern =>
          minimatch(s.source.file, pattern)
        )
      );

      if (allSourcesIgnored) {
        return false;
      }
    }
    return true;
  });
}

function applySeverityOverrides(contradictions: Contradiction[]): Contradiction[] {
  const overrides = config.severityOverrides;
  if (!overrides || Object.keys(overrides).length === 0) {
    return contradictions;
  }

  return contradictions.map(c => {
    const override = overrides[c.ruleId] || overrides[`${c.category}.${c.technology}`];
    if (override && override !== c.severity) {
      return { ...c, severity: override };
    }
    return c;
  });
}

function updateDiagnostics(contradictions: Contradiction[]): void {
  const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

  for (const c of contradictions) {
    for (const source of c.sources) {
      const line = Math.max(0, source.source.line - 1);
      const lineLength = 100;
      const range = new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, lineLength)
      );

      const severity =
        c.severity === 'critical'
          ? vscode.DiagnosticSeverity.Error
          : c.severity === 'warning'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(range, formatDiagnosticMessage(c), severity);
      diagnostic.source = 'envlint';
      diagnostic.code = c.ruleId;

      if (!diagnosticsMap.has(source.source.file)) {
        diagnosticsMap.set(source.source.file, []);
      }
      diagnosticsMap.get(source.source.file)!.push(diagnostic);
    }
  }

  diagnosticCollection.clear();
  for (const [file, diagnostics] of diagnosticsMap) {
    diagnosticCollection.set(vscode.Uri.file(file), diagnostics);
  }
}

function formatDiagnosticMessage(c: Contradiction): string {
  const sourceLines = c.sources.map(s => `  ${s.source.file}:${s.source.line} = ${s.value}`);
  const sourceBlock = sourceLines.length > 0 ? `\n\nSources:\n${sourceLines.join('\n')}` : '';
  return `${c.ruleId}: ${c.title}\n\n${c.explanation}${sourceBlock}`;
}

function updateStatusBar(score: number, contradictions: Contradiction[]): void {
  const critical = contradictions.filter(c => c.severity === 'critical');
  const warning = contradictions.filter(c => c.severity === 'warning');

  // Update status bar text
  if (critical.length > 0) {
    const ruleIds = [...new Set(critical.map(c => c.ruleId))].join(', ');
    statusBarItem.text = `$(error) envlint: ${critical.length} critical [${ruleIds}]`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (warning.length > 0) {
    const ruleIds = [...new Set(warning.map(c => c.ruleId))].join(', ');
    statusBarItem.text = `$(warning) envlint: ${warning.length} warnings [${ruleIds}]`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    // Show score with appropriate messaging
    let scoreMessage: string;
    if (score >= 90) {
      scoreMessage = `✅ ${score}% consistent`;
    } else if (score >= 70) {
      scoreMessage = `⚠️ ${score}% minor issues`;
    } else {
      scoreMessage = `❌ ${score}% needs attention`;
    }
    statusBarItem.text = `$(check) envlint: ${scoreMessage}`;
    statusBarItem.backgroundColor = undefined;
  }
  statusBarItem.show();
}
