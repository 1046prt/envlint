import { FactExtractor, ExtractorResult, FactWithoutId, getAuthority } from '../../types';
import * as path from 'path';

export class DockerExtractor implements FactExtractor {
  name = 'DockerExtractor';
  supportedFiles = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.docker-compose.yml', '.docker-compose.yaml'];

  extract(filePath: string, content: string): ExtractorResult {
    const facts: FactWithoutId[] = [];
    const errors: string[] = [];
    const fileName = path.basename(filePath);
    const authority = getAuthority(filePath);

    try {
      if (fileName.startsWith('Dockerfile') || fileName.includes('Dockerfile')) {
        this.extractFromDockerfile(filePath, content, facts, authority);
      } else if (fileName.includes('docker-compose')) {
        this.extractFromCompose(filePath, content, facts, authority);
      }
    } catch (e) {
      errors.push(`Failed to parse ${filePath}: ${e}`);
    }

    return { facts, errors };
  }

  private extractFromDockerfile(filePath: string, content: string, facts: FactWithoutId[], authority: number): void {
    const lines = content.split('\n');
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();

      const fromMatch = trimmed.match(/^FROM\s+(?:--platform=\S+\s+)?(\S+)/i);
      if (fromMatch) {
        const image = fromMatch[1];
        const version = this.normalizeImageVersion(image);
        if (version) {
          const technology = this.extractTechnology(image);
          facts.push({
            category: 'runtime',
            technology,
            value: version,
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: { dockerImage: image, instruction: 'FROM' },
          });
        }
      }

      const exposeMatch = trimmed.match(/^EXPOSE\s+(\d+)/i);
      if (exposeMatch) {
        facts.push({
          category: 'port',
          technology: 'docker',
          value: exposeMatch[1],
          source: { file: filePath, line: lineNum },
          confidence: 'high',
          authority,
          metadata: { instruction: 'EXPOSE' },
        });
      }
    }
  }

  private extractFromCompose(filePath: string, content: string, facts: FactWithoutId[], authority: number): void {
    const lines = content.split('\n');
    let lineNum = 0;
    let currentService: string | null = null;
    let inServices = false;
    let servicesIndent = -1;

    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;

      // Track when we enter/exit the "services:" block
      if (trimmed === 'services:' || trimmed === 'services: ') {
        inServices = true;
        servicesIndent = indent;
        currentService = null;
        continue;
      }

      // Exit services block when we hit a top-level key at same or lesser indent
      if (inServices && indent <= servicesIndent && trimmed.length > 0 && !trimmed.startsWith('#')) {
        inServices = false;
        currentService = null;
      }

      // Detect service names — direct children of services block (one indent level deeper)
      if (inServices && indent === servicesIndent + 2) {
        const serviceMatch = trimmed.match(/^([\w][\w.-]*):\s*$/);
        if (serviceMatch) {
          currentService = serviceMatch[1];
        }
      }

      const portMatch = trimmed.match(/^-?\s*"?(\d+):(\d+)(?:\/\w+)?"?/);
      if (portMatch) {
        facts.push({
          category: 'port',
          technology: 'docker-compose',
          value: portMatch[2],
          source: { file: filePath, line: lineNum },
          confidence: 'high',
          authority,
          metadata: {
            hostPort: portMatch[1],
            containerPort: portMatch[2],
            service: currentService || 'unknown',
          },
        });
      }

      const imageMatch = trimmed.match(/^image:\s*(\S+)/);
      if (imageMatch) {
        const image = imageMatch[1];
        const version = this.normalizeImageVersion(image);
        if (version) {
          const technology = this.extractTechnology(image);
          facts.push({
            category: 'runtime',
            technology,
            value: version,
            source: { file: filePath, line: lineNum },
            confidence: 'high',
            authority,
            metadata: { dockerImage: image, service: currentService || 'unknown' },
          });
        }
      }
    }
  }

  private extractTechnology(image: string): string {
    const name = image.split(':')[0].split('/').pop() || '';
    if (name.includes('node')) return 'node';
    if (name.includes('python')) return 'python';
    if (name.includes('java') || name.includes('openjdk')) return 'java';
    if (name.includes('ruby')) return 'ruby';
    if (name.includes('golang') || name.includes('go')) return 'go';
    if (name.includes('nginx')) return 'nginx';
    return name;
  }

  private normalizeImageVersion(image: string): string | null {
    const versionMatch = image.match(/:(\S+)/);
    if (!versionMatch) return null;
    let version = versionMatch[1];
    version = version.replace(/-(?:alpine|slim|bookworm|bullseye|buster|focal|jammy|noble)$/i, '');
    return version || null;
  }
}
