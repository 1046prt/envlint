import { FactExtractor, ExtractorResult, FactWithoutId, getAuthority } from '../../types';

export class DocumentationExtractor implements FactExtractor {
  name = 'DocumentationExtractor';
  supportedFiles = ['README.md', 'README.rst', 'README.txt', 'README'];

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

        const scriptMatch = trimmed.match(/(?:npm|yarn|pnpm)\s+run\s+([\w:-]+)/);
        if (scriptMatch) {
          facts.push({
            category: 'script',
            technology: scriptMatch[1],
            value: trimmed,
            source: { file: filePath, line: lineNum },
            confidence: 'low',
            authority,
            metadata: { command: trimmed, detected: 'npm_command', scriptName: scriptMatch[1] },
          });
        }

        const portMatch = trimmed.match(/localhost:(\d+)/);
        if (portMatch) {
          facts.push({
            category: 'port',
            technology: 'documentation',
            value: portMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'low',
            authority,
            metadata: { url: trimmed, detected: 'localhost_url' },
          });
        }

        const nodeMatch = trimmed.match(/node(?:\.?js)?\s+(?:v?(\d+))/i);
        if (nodeMatch) {
          facts.push({
            category: 'runtime',
            technology: 'node',
            value: nodeMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'low',
            authority,
            metadata: { context: trimmed },
          });
        }

        const pythonMatch = trimmed.match(/python\s+(?:v?(\d+\.?\d*))/i);
        if (pythonMatch) {
          facts.push({
            category: 'runtime',
            technology: 'python',
            value: pythonMatch[1],
            source: { file: filePath, line: lineNum },
            confidence: 'low',
            authority,
            metadata: { context: trimmed },
          });
        }

        const installMatch = trimmed.match(/(?:npm|yarn|pnpm)\s+install/);
        if (installMatch) {
          const packageManager = installMatch[0].split(' ')[0];
          facts.push({
            category: 'package_manager',
            technology: packageManager,
            value: 'install',
            source: { file: filePath, line: lineNum },
            confidence: 'low',
            authority,
            metadata: { command: installMatch[0] },
          });
        }
      }
    } catch (e) {
      errors.push(`Failed to parse ${filePath}: ${e}`);
    }

    return { facts, errors };
  }
}
