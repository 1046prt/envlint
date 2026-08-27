export type FactCategory =
  | 'runtime'
  | 'environment'
  | 'package_manager'
  | 'port'
  | 'script'
  | 'dependency'
  | 'api_endpoint'
  | 'configuration';

export type Severity = 'critical' | 'warning' | 'possible' | 'consistent';

export type FactConfidence = 'high' | 'medium' | 'low';

export interface Location {
  file: string;
  line: number;
  column?: number;
}

export interface Fact {
  id: string;
  category: FactCategory;
  technology: string;
  value: string;
  source: Location;
  confidence: FactConfidence;
  authority: number; // 0-100, higher = more authoritative
  metadata?: Record<string, string>;
}

export type FactWithoutId = Omit<Fact, 'id'>;

export interface FactGroup {
  category: FactCategory;
  technology: string;
  facts: Fact[];
}

export interface Contradiction {
  id: string;
  ruleId: string;
  severity: Severity;
  category: FactCategory;
  technology: string;
  title: string;
  description: string;
  explanation: string;
  sources: Fact[];
  confidence: number;
  score: number;
  suggestedFix?: QuickFix;
}

export interface QuickFix {
  label: string;
  action: 'replace' | 'add' | 'remove';
  target: Location;
  newValue?: string;
}

export interface ExtractorResult {
  facts: FactWithoutId[];
  errors: string[];
}

export interface FactExtractor {
  name: string;
  supportedFiles: string[];
  extract(filePath: string, content: string): ExtractorResult;
}

export interface IgnoreRule {
  rule: string; // e.g. "runtime.node-version" or "*"
  files?: string[]; // glob patterns, omit = all files
  reason?: string;
}

export interface EnvLintConfig {
  enabled: boolean;
  excludePaths: string[];
  ignoreRules: IgnoreRule[];
  severityOverrides: Record<string, Severity>;
  enableAuthorityScoring: boolean;
}

export const DEFAULT_CONFIG: EnvLintConfig = {
  enabled: true,
  excludePaths: ['node_modules', 'dist', 'build', '.git', 'out', 'coverage', '.next', '.nuxt', '.cache', 'target'],
  ignoreRules: [],
  severityOverrides: {},
  enableAuthorityScoring: true,
};

// Source authority levels by file type
export const SOURCE_AUTHORITY: Record<string, number> = {
  // Runtime version files — authoritative
  '.nvmrc': 95,
  '.node-version': 95,
  '.python-version': 95,
  '.ruby-version': 95,
  '.tool-versions': 95,

  // Package manifests — authoritative
  'package.json': 90,
  'pom.xml': 90,
  'build.gradle': 90,

  // Container definitions — authoritative
  'Dockerfile': 85,
  'docker-compose.yml': 85,
  'docker-compose.yaml': 85,

  // CI — authoritative
  '.github/workflows': 85,

  // Env templates — high
  '.env.example': 80,
  '.env.template': 80,

  // Env actual — high
  '.env': 75,
  '.env.local': 75,

  // Documentation — low
  'README.md': 40,
  'README.rst': 40,
  'README.txt': 40,
  'README': 40,
  'docs': 35,
};

export function getAuthority(filePath: string): number {
  // Check exact filename matches first
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
  if (SOURCE_AUTHORITY[fileName]) {
    return SOURCE_AUTHORITY[fileName];
  }

  // Check path prefix matches
  for (const [pattern, authority] of Object.entries(SOURCE_AUTHORITY)) {
    if (filePath.includes(pattern)) {
      return authority;
    }
  }

  return 50; // default authority for unknown files
}
