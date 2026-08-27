import { DockerExtractor } from '../engine/extractors/docker';

describe('DockerExtractor', () => {
  const extractor = new DockerExtractor();

  describe('Dockerfile', () => {
    it('extracts FROM with version', () => {
      const result = extractor.extract('Dockerfile', 'FROM node:22-alpine\nWORKDIR /app');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].category).toBe('runtime');
      expect(result.facts[0].technology).toBe('node');
      expect(result.facts[0].value).toBe('22');
      expect(result.facts[0].confidence).toBe('high');
    });

    it('extracts EXPOSE port', () => {
      const result = extractor.extract('Dockerfile', 'FROM node:22\nEXPOSE 3000');
      expect(result.facts).toHaveLength(2);
      const portFact = result.facts.find(f => f.category === 'port');
      expect(portFact).toBeDefined();
      expect(portFact!.value).toBe('3000');
    });

    it('extracts python image', () => {
      const result = extractor.extract('Dockerfile', 'FROM python:3.12-slim');
      expect(result.facts[0].technology).toBe('python');
      expect(result.facts[0].value).toBe('3.12');
    });

    it('handles FROM without version tag', () => {
      const result = extractor.extract('Dockerfile', 'FROM node\nRUN npm install');
      expect(result.facts).toHaveLength(0);
    });

    it('strips -bookworm suffix', () => {
      const result = extractor.extract('Dockerfile', 'FROM python:3.11-bookworm');
      expect(result.facts[0].value).toBe('3.11');
    });

    it('strips -slim suffix', () => {
      const result = extractor.extract('Dockerfile', 'FROM node:20-slim');
      expect(result.facts[0].value).toBe('20');
    });

    it('handles multi-stage builds', () => {
      const content = 'FROM node:22-alpine AS builder\nRUN npm run build\nFROM node:20-slim\nCOPY --from=builder';
      const result = extractor.extract('Dockerfile', content);
      const runtimeFacts = result.facts.filter(f => f.category === 'runtime');
      expect(runtimeFacts).toHaveLength(2);
      expect(runtimeFacts[0].value).toBe('22');
      expect(runtimeFacts[1].value).toBe('20');
    });

    it('sets correct line numbers', () => {
      const result = extractor.extract('Dockerfile', 'FROM node:22\nRUN npm install\nEXPOSE 3000');
      expect(result.facts[0].source.line).toBe(1);
      const portFact = result.facts.find(f => f.category === 'port');
      expect(portFact!.source.line).toBe(3);
    });
  });

  describe('docker-compose.yml', () => {
    it('extracts quoted port mappings', () => {
      const content = 'services:\n  app:\n    ports:\n      - "3000:3000"';
      const result = extractor.extract('docker-compose.yml', content);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].category).toBe('port');
      expect(result.facts[0].value).toBe('3000');
    });

    it('extracts unquoted port mappings', () => {
      const content = 'services:\n  app:\n    ports:\n      - 3000:3000';
      const result = extractor.extract('docker-compose.yml', content);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].category).toBe('port');
      expect(result.facts[0].value).toBe('3000');
    });

    it('extracts port with protocol suffix', () => {
      const content = 'services:\n  app:\n    ports:\n      - "3000:3000/tcp"';
      const result = extractor.extract('docker-compose.yml', content);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].value).toBe('3000');
    });

    it('extracts image with version', () => {
      const content = 'services:\n  app:\n    image: node:22';
      const result = extractor.extract('docker-compose.yml', content);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].technology).toBe('node');
    });

    it('extracts container port (not host port)', () => {
      const content = 'services:\n  app:\n    ports:\n      - "8080:3000"';
      const result = extractor.extract('docker-compose.yml', content);
      expect(result.facts[0].value).toBe('3000');
      expect(result.facts[0].metadata?.hostPort).toBe('8080');
    });
  });

  describe('.docker-compose.yml (dot-prefixed)', () => {
    it('extracts from dot-prefixed docker-compose file', () => {
      const content = 'services:\n  app:\n    ports:\n      - "3000:3000"';
      const result = extractor.extract('.docker-compose.yml', content);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].category).toBe('port');
    });
  });

  describe('edge cases', () => {
    it('handles malformed Dockerfile gracefully', () => {
      const result = extractor.extract('Dockerfile', 'FROM\nEXPOSE\nWORKDIR');
      expect(result.errors).toHaveLength(0);
    });

    it('sets high authority', () => {
      const result = extractor.extract('Dockerfile', 'FROM node:22');
      expect(result.facts[0].authority).toBe(85);
    });

    it('handles empty file', () => {
      const result = extractor.extract('Dockerfile', '');
      expect(result.facts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('handles multiple EXPOSE instructions', () => {
      const result = extractor.extract('Dockerfile', 'EXPOSE 3000\nEXPOSE 8080');
      const ports = result.facts.filter(f => f.category === 'port');
      expect(ports).toHaveLength(2);
      expect(ports[0].value).toBe('3000');
      expect(ports[1].value).toBe('8080');
    });
  });

  describe('supportedFiles includes .docker-compose.yml', () => {
    it('lists all supported file patterns', () => {
      expect(extractor.supportedFiles).toContain('.docker-compose.yml');
      expect(extractor.supportedFiles).toContain('.docker-compose.yaml');
      expect(extractor.supportedFiles).toContain('docker-compose.yml');
      expect(extractor.supportedFiles).toContain('docker-compose.yaml');
      expect(extractor.supportedFiles).toContain('Dockerfile');
    });
  });
});
