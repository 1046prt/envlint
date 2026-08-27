import { FactExtractor, ExtractorResult, FactWithoutId, getAuthority } from '../../types';

export class PackageJsonExtractor implements FactExtractor {
  name = 'PackageJsonExtractor';
  supportedFiles = ['package.json'];

  extract(filePath: string, content: string): ExtractorResult {
    const facts: FactWithoutId[] = [];
    const errors: string[] = [];
    const authority = getAuthority(filePath);

    try {
      const pkg = JSON.parse(content);

      if (pkg.engines) {
        if (pkg.engines.node) {
          facts.push({
            category: 'runtime',
            technology: 'node',
            value: pkg.engines.node,
            source: { file: filePath, line: this.findKeyLine(content, '"engines"') || 1 },
            confidence: 'medium',
            authority,
            metadata: { field: 'engines.node' },
          });
        }
        if (pkg.engines.npm) {
          facts.push({
            category: 'package_manager',
            technology: 'npm',
            value: pkg.engines.npm,
            source: { file: filePath, line: this.findKeyLine(content, '"engines"') || 1 },
            confidence: 'medium',
            authority,
            metadata: { field: 'engines.npm' },
          });
        }
      }

      if (pkg.packageManager) {
        const match = pkg.packageManager.match(/^(\w+)@(.+)$/);
        if (match) {
          facts.push({
            category: 'package_manager',
            technology: match[1].toLowerCase(),
            value: match[2],
            source: { file: filePath, line: this.findKeyLine(content, '"packageManager"') || 1 },
            confidence: 'high',
            authority,
            metadata: { field: 'packageManager' },
          });
        }
      }

      if (pkg.scripts) {
        for (const [name, command] of Object.entries(pkg.scripts)) {
          if (typeof command === 'string') {
            facts.push({
              category: 'script',
              technology: 'npm',
              value: `${name}: ${command}`,
              source: { file: filePath, line: this.findKeyLine(content, `"${name}"`) || 1 },
              confidence: 'high',
              authority,
              metadata: {
                scriptName: name,
                scriptCommand: command,
              },
            });
          }
        }
      }

      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          if (typeof version === 'string') {
            facts.push({
              category: 'dependency',
              technology: name,
              value: version,
              source: { file: filePath, line: 1 },
              confidence: 'high',
              authority,
              metadata: { field: 'dependencies' },
            });
          }
        }
      }
    } catch (e) {
      errors.push(`Failed to parse ${filePath}: ${e}`);
    }

    return { facts, errors };
  }

  private findKeyLine(content: string, key: string): number | null {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(key)) {
        return i + 1;
      }
    }
    return null;
  }
}
