import { FactExtractor, ExtractorResult, FactWithoutId, getAuthority } from '../../types';

export class GitHubActionsExtractor implements FactExtractor {
  name = 'GitHubActionsExtractor';
  supportedFiles = ['.github/workflows/*.yml', '.github/workflows/*.yaml'];

  extract(filePath: string, content: string): ExtractorResult {
    const facts: FactWithoutId[] = [];
    const errors: string[] = [];
    const authority = getAuthority(filePath);

    try {
      const lines = content.split('\n');
      let lineNum = 0;

      for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();

        const nodeVersionMatch = trimmed.match(/node-version:\s*['"]?(\d+\.?\d*)['"]?/);
        if (nodeVersionMatch) {
          facts.push({
            category: 'runtime',
            technology: 'node',
            value: nodeVersionMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: { ci: 'github-actions' },
          });
        }

        const javaVersionMatch = trimmed.match(/java-version:\s*['"]?(\d+)['"]?/);
        if (javaVersionMatch) {
          facts.push({
            category: 'runtime',
            technology: 'java',
            value: javaVersionMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: { ci: 'github-actions' },
          });
        }

        const pythonVersionMatch = trimmed.match(/python-version:\s*['"]?(\d+\.?\d*)['"]?/);
        if (pythonVersionMatch) {
          facts.push({
            category: 'runtime',
            technology: 'python',
            value: pythonVersionMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: { ci: 'github-actions' },
          });
        }

        const goVersionMatch = trimmed.match(/go-version:\s*['"]?(\d+\.?\d*)['"]?/);
        if (goVersionMatch) {
          facts.push({
            category: 'runtime',
            technology: 'go',
            value: goVersionMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: { ci: 'github-actions' },
          });
        }
      }
    } catch (e) {
      errors.push(`Failed to parse ${filePath}: ${e}`);
    }

    return { facts, errors };
  }
}
