import { FactGroup, Contradiction, Severity } from '../types';
import { randomUUID } from 'crypto';

export interface ContradictionRule {
  id: string;
  name: string;
  matches(group: FactGroup): boolean;
  find(group: FactGroup): Contradiction | null;
}

export interface CrossGroupRule {
  id: string;
  name: string;
  analyze(groups: FactGroup[]): Contradiction[];
}

class VersionMismatchRule implements ContradictionRule {
  id = 'RUN001';
  name = 'Runtime version mismatch';

  matches(group: FactGroup): boolean {
    if (group.category !== 'runtime' && group.category !== 'package_manager') return false;
    if (group.category === 'runtime' && group.technology === 'node') return false;
    return true;
  }

  find(group: FactGroup): Contradiction | null {
    if (group.facts.length < 2) return null;

    const uniqueValues = new Set(group.facts.map(f => f.value));
    if (uniqueValues.size <= 1) return null;

    const sources = group.facts;
    const severity = this.determineSeverity(group);

    const highAuth = sources.filter(s => s.authority >= 80);
    const likelyVersion = highAuth.length > 0
      ? this.mostCommonValue(highAuth.map(s => s.value))
      : this.mostCommonValue(sources.map(s => s.value));

    return {
      id: randomUUID(),
      ruleId: this.id,
      severity,
      category: group.category,
      technology: group.technology,
      title: `${group.technology} version mismatch`,
      description: `Found ${uniqueValues.size} different values: ${Array.from(uniqueValues).join(', ')}`,
      explanation: `Multiple sources declare different ${group.technology} versions.\n\nLikely intended version: ${likelyVersion}\n\nThis can cause build failures, dependency conflicts, or runtime errors.`,
      sources,
      confidence: this.calculateConfidence(group, sources.length),
      score: 0,
    };
  }

  private determineSeverity(group: FactGroup): Severity {
    const hasCI = group.facts.some(f => f.metadata?.ci);
    const hasNonCI = group.facts.some(f => !f.metadata?.ci);
    if (hasCI && hasNonCI) return 'critical';

    const hasDocker = group.facts.some(f => f.metadata?.dockerImage);
    const hasLocal = group.facts.some(f => !f.metadata?.dockerImage && !f.metadata?.ci);
    if (hasDocker && hasLocal) return 'warning';

    return 'warning';
  }

  private calculateConfidence(group: FactGroup, sourceCount: number): number {
    let confidence = 70;
    if (sourceCount >= 4) confidence += 15;
    else if (sourceCount >= 3) confidence += 10;
    else if (sourceCount >= 2) confidence += 5;

    if (group.facts.some(f => f.source.file.includes('.nvmrc') || f.source.file.includes('.node-version'))) {
      confidence += 10;
    }

    return Math.min(99, confidence);
  }

  private mostCommonValue(values: string[]): string {
    const counts = new Map<string, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    let maxCount = 0;
    let result = values[0];
    for (const [v, c] of counts) {
      if (c > maxCount) {
        maxCount = c;
        result = v;
      }
    }
    return result;
  }
}

class PortMismatchRule implements ContradictionRule {
  id = 'CFG001';
  name = 'Port mismatch';

  matches(group: FactGroup): boolean {
    return group.category === 'port';
  }

  find(group: FactGroup): Contradiction | null {
    if (group.facts.length < 2) return null;

    // Group facts by service context to avoid comparing different services
    const byService = this.groupByService(group.facts);
    const contradictions: Contradiction[] = [];

    for (const [, facts] of byService) {
      if (facts.length < 2) continue;
      const uniqueValues = new Set(facts.map(f => f.value));
      if (uniqueValues.size <= 1) continue;

      contradictions.push({
        id: randomUUID(),
        ruleId: this.id,
        severity: 'warning',
        category: 'port',
        technology: 'port',
        title: 'Port mismatch',
        description: `Found ${uniqueValues.size} different ports: ${Array.from(uniqueValues).join(', ')}`,
        explanation: `Different parts of the project declare different ports for the same service.\n\nThis typically means the application, container, and/or documentation are out of sync.`,
        sources: facts,
        confidence: 80,
        score: 0,
      });
    }

    // Return the most severe contradiction, or null
    return contradictions.length > 0 ? contradictions[0] : null;
  }

  private groupByService(facts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    for (const fact of facts) {
      // Determine service context
      let service = fact.metadata?.service || 'app';
      // Dockerfile EXPOSE and README facts belong to the main app
      if (fact.metadata?.instruction === 'EXPOSE' || fact.metadata?.detected === 'localhost_url') {
        service = 'app';
      }
      if (!groups.has(service)) {
        groups.set(service, []);
      }
      groups.get(service)!.push(fact);
    }
    return groups;
  }
}

class MissingEnvVarRule implements ContradictionRule {
  id = 'ENV001';
  name = 'Environment variable mismatch';

  matches(group: FactGroup): boolean {
    return group.category === 'environment';
  }

  find(group: FactGroup): Contradiction | null {
    const exampleFiles = group.facts.filter(f => f.metadata?.envType === 'example');
    const baseFiles = group.facts.filter(f => f.metadata?.envType === 'base');

    if (exampleFiles.length === 0 || baseFiles.length === 0) return null;

    const exampleVars = new Set(exampleFiles.map(f => f.technology));
    const baseVars = new Set(baseFiles.map(f => f.technology));

    const missingInBase = Array.from(exampleVars).filter(v => !baseVars.has(v));
    const missingInExample = Array.from(baseVars).filter(v => !exampleVars.has(v));

    if (missingInBase.length === 0 && missingInExample.length === 0) return null;

    const sources = [
      ...exampleFiles.filter(f => missingInBase.includes(f.technology) || missingInExample.includes(f.technology)),
      ...baseFiles.filter(f => missingInBase.includes(f.technology) || missingInExample.includes(f.technology)),
    ];

    const parts: string[] = [];
    if (missingInBase.length > 0) {
      parts.push(`Missing from .env: ${missingInBase.join(', ')}`);
    }
    if (missingInExample.length > 0) {
      parts.push(`Extra in .env (not in .env.example): ${missingInExample.join(', ')}`);
    }

    return {
      id: randomUUID(),
      ruleId: this.id,
      severity: 'warning',
      category: 'environment',
      technology: 'env',
      title: 'Environment variable mismatch',
      description: parts.join('; '),
      explanation: `.env and .env.example have different variables.\n\n${parts.join('\n')}\n\nThis usually means someone added a variable but forgot to update the example file.`,
      sources,
      confidence: 85,
      score: 0,
    };
  }
}

class PackageManagerMismatchRule implements ContradictionRule {
  id = 'PKG001';
  name = 'Multiple package managers';

  matches(group: FactGroup): boolean {
    if (group.category !== 'package_manager') return false;
    const managers = new Set(group.facts.map(f => f.technology));
    return managers.size > 1;
  }

  find(group: FactGroup): Contradiction | null {
    const managers = Array.from(new Set(group.facts.map(f => f.technology)));
    if (managers.length <= 1) return null;

    return {
      id: randomUUID(),
      ruleId: this.id,
      severity: 'warning',
      category: 'package_manager',
      technology: managers.join('/'),
      title: 'Multiple package managers detected',
      description: `Found: ${managers.join(', ')}`,
      explanation: `The project references multiple package managers.\n\nThis can cause lockfile conflicts and inconsistent dependency resolution.`,
      sources: group.facts,
      confidence: 75,
      score: 0,
    };
  }
}

class ScriptMismatchRule implements ContradictionRule {
  id = 'PKG002';
  name = 'Invalid script reference';

  matches(group: FactGroup): boolean {
    return group.category === 'script';
  }

  find(group: FactGroup): Contradiction | null {
    const readmeScripts = group.facts.filter(f => f.metadata?.detected === 'npm_command');
    const packageScripts = group.facts.filter(f => f.metadata?.scriptName);

    if (readmeScripts.length === 0 || packageScripts.length === 0) return null;

    const packageScriptNames = new Set(packageScripts.map(f => f.metadata?.scriptName));
    const invalidScripts = readmeScripts.filter(f => {
      const match = f.value.match(/(?:npm|yarn|pnpm)\s+run\s+([\w:-]+)/);
      return match && !packageScriptNames.has(match[1]);
    });

    if (invalidScripts.length === 0) return null;

    return {
      id: randomUUID(),
      ruleId: this.id,
      severity: 'critical',
      category: 'script',
      technology: 'npm',
      title: 'Invalid script reference in documentation',
      description: `README references scripts that don't exist in package.json`,
      explanation: `The README tells users to run a script that doesn't exist.\n\nThis will cause errors for anyone following the documentation.`,
      sources: invalidScripts,
      confidence: 95,
      score: 0,
      suggestedFix: {
        label: 'Fix script reference',
        action: 'replace',
        target: invalidScripts[0].source,
      },
    };
  }
}

class NodeVersionMismatchRule implements ContradictionRule {
  id = 'RUN002';
  name = 'Node version mismatch';

  matches(group: FactGroup): boolean {
    return group.category === 'runtime' && group.technology === 'node';
  }

  find(group: FactGroup): Contradiction | null {
    if (group.facts.length < 2) return null;

    const uniqueValues = new Set(group.facts.map(f => f.value));
    if (uniqueValues.size <= 1) return null;

    const ciFacts = group.facts.filter(f => f.metadata?.ci);
    const localFacts = group.facts.filter(f => !f.metadata?.ci && !f.metadata?.dockerImage);
    const dockerFacts = group.facts.filter(f => f.metadata?.dockerImage);

    let severity: Severity = 'warning';
    if (ciFacts.length > 0 && (localFacts.length > 0 || dockerFacts.length > 0)) {
      severity = 'critical';
    }

    const parts: string[] = [];
    if (localFacts.length > 0) parts.push(`Local/Config: ${localFacts[0].value}`);
    if (dockerFacts.length > 0) parts.push(`Docker: ${dockerFacts[0].value}`);
    if (ciFacts.length > 0) parts.push(`CI: ${ciFacts[0].value}`);

    return {
      id: randomUUID(),
      ruleId: this.id,
      severity,
      category: 'runtime',
      technology: 'node',
      title: 'Node version mismatch',
      description: parts.join(', '),
      explanation: `Different sources declare different Node.js versions.\n\n${parts.join('\n')}\n\nCI using a different Node version than your local/Docker environment can cause "works on my machine" issues.`,
      sources: group.facts,
      confidence: 90,
      score: 0,
    };
  }
}

// Cross-group rules

class EnvironmentCompletenessRule implements CrossGroupRule {
  id = 'ENV002';
  name = 'Missing environment variables';

  analyze(groups: FactGroup[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const envGroups = groups.filter(g => g.category === 'environment');

    const exampleVars = new Map<string, string>();
    const baseVars = new Map<string, string>();

    for (const group of envGroups) {
      for (const fact of group.facts) {
        if (fact.metadata?.envType === 'example') {
          exampleVars.set(fact.technology, fact.source.file);
        }
        if (fact.metadata?.envType === 'base') {
          baseVars.set(fact.technology, fact.source.file);
        }
      }
    }

    if (exampleVars.size === 0 || baseVars.size === 0) return contradictions;

    const missingInBase: string[] = [];
    const missingSources = [];

    for (const [varName, file] of exampleVars) {
      if (!baseVars.has(varName)) {
        missingInBase.push(varName);
        missingSources.push({
          id: randomUUID(),
          category: 'environment' as const,
          technology: varName,
          value: '',
          source: { file, line: 0 },
          confidence: 'medium' as const,
          authority: 80,
          metadata: { envType: 'example' },
        });
      }
    }

    if (missingInBase.length > 0) {
      contradictions.push({
        id: randomUUID(),
        ruleId: this.id,
        severity: 'warning',
        category: 'environment',
        technology: 'env',
        title: 'Missing environment variables',
        description: `Variables in .env.example but not in .env: ${missingInBase.join(', ')}`,
        explanation: `.env.example declares variables that are missing from .env.\n\nMissing: ${missingInBase.join(', ')}\n\nNew contributors who copy .env.example will be missing required configuration.`,
        sources: missingSources,
        confidence: 85,
        score: 0,
      });
    }

    return contradictions;
  }
}

class ScriptValidityRule implements CrossGroupRule {
  id = 'DOC001';
  name = 'Invalid script in documentation';

  analyze(groups: FactGroup[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const scriptGroups = groups.filter(g => g.category === 'script');

    const packageScripts = new Map<string, string>();
    for (const group of scriptGroups) {
      for (const fact of group.facts) {
        if (fact.metadata?.scriptName && fact.metadata?.detected !== 'npm_command') {
          packageScripts.set(fact.metadata.scriptName, fact.metadata.scriptCommand || '');
        }
      }
    }

    if (packageScripts.size === 0) return contradictions;

    const invalidScripts = [];
    for (const group of scriptGroups) {
      for (const fact of group.facts) {
        if (fact.metadata?.detected === 'npm_command') {
          const match = fact.value.match(/(?:npm|yarn|pnpm)\s+run\s+([\w:-]+)/);
          if (match && !packageScripts.has(match[1])) {
            invalidScripts.push(fact);
          }
        }
      }
    }

    if (invalidScripts.length > 0) {
      contradictions.push({
        id: randomUUID(),
        ruleId: this.id,
        severity: 'critical',
        category: 'script',
        technology: 'npm',
        title: 'Invalid script reference in documentation',
        description: `README references scripts that don't exist in package.json`,
        explanation: `The documentation tells users to run scripts that don't exist.\n\nThis will break for anyone following the setup instructions.`,
        sources: invalidScripts,
        confidence: 95,
        score: 0,
        suggestedFix: {
          label: 'Fix script reference',
          action: 'replace',
          target: invalidScripts[0].source,
        },
      });
    }

    return contradictions;
  }
}

class PortConsistencyRule implements CrossGroupRule {
  id = 'CFG002';
  name = 'Port inconsistency';

  analyze(groups: FactGroup[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const portGroups = groups.filter(g => g.category === 'port');

    // Collect all port facts with service context
    const appPorts: Array<{ value: string; file: string; line: number; service: string }> = [];

    for (const group of portGroups) {
      for (const fact of group.facts) {
        let service = fact.metadata?.service || 'app';
        if (fact.metadata?.instruction === 'EXPOSE' || fact.metadata?.detected === 'localhost_url') {
          service = 'app';
        }
        appPorts.push({
          value: fact.value,
          file: fact.source.file,
          line: fact.source.line,
          service,
        });
      }
    }

    // Group by service, then compare across sources within same service
    const byService = new Map<string, typeof appPorts>();
    for (const port of appPorts) {
      if (!byService.has(port.service)) {
        byService.set(port.service, []);
      }
      byService.get(port.service)!.push(port);
    }

    for (const [service, ports] of byService) {
      if (ports.length < 2) continue;

      const uniquePorts = [...new Set(ports.map(p => p.value))];
      if (uniquePorts.length <= 1) continue;

      // Only flag if there are ports from different source types (not just multiple docker-compose entries)
      const sourceTypes = new Set(ports.map(p => p.file));
      if (sourceTypes.size <= 1) continue;

      contradictions.push({
        id: randomUUID(),
        ruleId: this.id,
        severity: 'warning',
        category: 'port',
        technology: 'port',
        title: `Port mismatch for service "${service}"`,
        description: `Found ${uniquePorts.length} different ports for ${service}: ${uniquePorts.join(', ')}`,
        explanation: `Different parts of the project declare different ports for the ${service} service.\n\nApplication ports, Docker EXPOSE, docker-compose mappings, and documentation URLs should all agree.`,
        sources: ports.map(p => ({
          id: randomUUID(),
          category: 'port' as const,
          technology: 'port',
          value: p.value,
          source: { file: p.file, line: p.line },
          confidence: 'high' as const,
          authority: 80,
          metadata: { service: p.service },
        })),
        confidence: 80,
        score: 0,
      });
    }

    return contradictions;
  }
}

export const rules: ContradictionRule[] = [
  new NodeVersionMismatchRule(),
  new VersionMismatchRule(),
  new PortMismatchRule(),
  new MissingEnvVarRule(),
  new PackageManagerMismatchRule(),
  new ScriptMismatchRule(),
];

export const crossGroupRules: CrossGroupRule[] = [
  new EnvironmentCompletenessRule(),
  new ScriptValidityRule(),
  new PortConsistencyRule(),
];
