import { FactExtractor, ExtractorResult, FactWithoutId, getAuthority } from '../../types';
import * as path from 'path';

export class RuntimeExtractor implements FactExtractor {
  name = 'RuntimeExtractor';
  supportedFiles = ['.nvmrc', '.node-version', '.python-version', '.ruby-version', '.tool-versions'];

  extract(filePath: string, content: string): ExtractorResult {
    const facts: FactWithoutId[] = [];
    const errors: string[] = [];
    const fileName = path.basename(filePath);
    const authority = getAuthority(filePath);

    try {
      const lines = content.trim().split('\n');

      if (fileName === '.tool-versions') {
        return this.extractToolVersions(filePath, lines, authority);
      }

      let lineNum = 0;
      for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const technology = this.getTechnology(fileName);
        const version = this.parseVersion(trimmed);

        if (version) {
          facts.push({
            category: 'runtime',
            technology,
            value: version,
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: {
              runtimeFile: fileName,
              rawVersion: trimmed,
            },
          });
        }
      }
    } catch (e) {
      errors.push(`Failed to parse ${filePath}: ${e}`);
    }

    return { facts, errors };
  }

  private extractToolVersions(
    filePath: string,
    lines: string[],
    authority: number
  ): ExtractorResult {
    const facts: FactWithoutId[] = [];
    const errors: string[] = [];

    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const match = trimmed.match(/^(\S+)\s+(\S+)/);
      if (match) {
        const [, toolName, version] = match;
        const technology = this.getToolTechnology(toolName);
        if (technology) {
          facts.push({
            category: 'runtime',
            technology,
            value: version,
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: {
              runtimeFile: '.tool-versions',
              rawVersion: trimmed,
              toolName,
            },
          });
        }
      }
    }

    return { facts, errors };
  }

  private getToolTechnology(toolName: string): string | null {
    const map: Record<string, string> = {
      'nodejs': 'node',
      'node': 'node',
      'python': 'python',
      'ruby': 'ruby',
      'java': 'java',
      'golang': 'go',
      'go': 'go',
    };
    return map[toolName.toLowerCase()] || null;
  }

  private getTechnology(fileName: string): string {
    if (fileName === '.nvmrc' || fileName === '.node-version') return 'node';
    if (fileName === '.python-version') return 'python';
    if (fileName === '.ruby-version') return 'ruby';
    return 'unknown';
  }

  private parseVersion(line: string): string | null {
    const versionMatch = line.match(/^(v?)((?:\d+\.)?(?:\d+\.)?(?:\d+))$/i);
    if (versionMatch) {
      return versionMatch[2];
    }

    const ltsMatch = line.match(/^lts\/(.+)/i);
    if (ltsMatch) {
      return `lts/${ltsMatch[1]}`;
    }

    return null;
  }
}
