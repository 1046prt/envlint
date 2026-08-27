import { FactExtractor, ExtractorResult, FactWithoutId, getAuthority, FactConfidence } from '../../types';
import * as path from 'path';

export class EnvironmentExtractor implements FactExtractor {
  name = 'EnvironmentExtractor';
  supportedFiles = ['.env', '.env.example', '.env.template', '.env.local', '.env.development', '.env.production'];

  extract(filePath: string, content: string): ExtractorResult {
    const facts: FactWithoutId[] = [];
    const errors: string[] = [];
    const fileName = path.basename(filePath);
    const authority = getAuthority(filePath);

    try {
      const lines = content.split('\n');
      let lineNum = 0;

      for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          const envType = this.getEnvType(fileName);
          const confidence: FactConfidence = envType === 'example' ? 'medium' : 'high';

          facts.push({
            category: 'environment',
            technology: key,
            value: value || '',
            source: { file: filePath, line: lineNum },
            confidence,
            authority,
            metadata: {
              envFile: fileName,
              envType,
            },
          });
        }
      }
    } catch (e) {
      errors.push(`Failed to parse ${filePath}: ${e}`);
    }

    return { facts, errors };
  }

  private getEnvType(fileName: string): string {
    if (fileName === '.env') return 'base';
    if (fileName === '.env.example' || fileName === '.env.template') return 'example';
    if (fileName.includes('.local')) return 'local';
    if (fileName.includes('.development')) return 'development';
    if (fileName.includes('.production')) return 'production';
    return 'other';
  }
}
