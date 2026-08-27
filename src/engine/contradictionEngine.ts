import { FactGroup, Contradiction, Severity } from '../types';
import { rules, crossGroupRules, ContradictionRule, CrossGroupRule } from '../rules';

export class ContradictionEngine {
  private rules: ContradictionRule[];
  private crossGroupRules: CrossGroupRule[];

  constructor() {
    this.rules = rules;
    this.crossGroupRules = crossGroupRules;
  }

  analyze(groups: FactGroup[], enableAuthorityScoring = true): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const group of groups) {
      const uniqueValues = new Set(group.facts.map(f => f.value));
      if (uniqueValues.size <= 1) {
        continue;
      }

      for (const rule of this.rules) {
        if (rule.matches(group)) {
          const contradiction = rule.find(group);
          if (contradiction) {
            contradictions.push(contradiction);
          }
        }
      }
    }

    for (const rule of this.crossGroupRules) {
      contradictions.push(...rule.analyze(groups));
    }

    const deduplicated = this.deduplicate(contradictions);
    return deduplicated.map(c => this.computeScore(c, enableAuthorityScoring));
  }

  private deduplicate(contradictions: Contradiction[]): Contradiction[] {
    const seen = new Map<string, Contradiction>();

    for (const c of contradictions) {
      const key = this.getContradictionKey(c);
      const existing = seen.get(key);

      if (!existing || c.confidence > existing.confidence) {
        seen.set(key, c);
      }
    }

    return Array.from(seen.values());
  }

  private getContradictionKey(c: Contradiction): string {
    const sourceKeys = c.sources
      .map(s => `${s.category}:${s.technology}:${s.value}`)
      .sort()
      .join('|');
    return sourceKeys;
  }

  private computeScore(c: Contradiction, enableAuthorityScoring: boolean): Contradiction {
    let score = c.confidence;

    if (enableAuthorityScoring) {
      const authorities = c.sources.map(s => s.authority);
      const avgAuthority = authorities.reduce((a, b) => a + b, 0) / authorities.length;
      const maxAuthority = Math.max(...authorities);
      const minAuthority = Math.min(...authorities);
      const authoritySpread = maxAuthority - minAuthority;

      if (authoritySpread > 30 && avgAuthority > 70) {
        score = Math.min(99, score + 10);
      }

      if (avgAuthority < 50) {
        score = Math.max(20, score - 15);
      }

      const uniqueValues = new Set(c.sources.map(s => s.value));
      if (c.sources.length >= 4 && uniqueValues.size >= 3) {
        score = Math.min(99, score + 5);
      }
    }

    return { ...c, score: Math.round(score) };
  }

  calculateScore(contradictions: Contradiction[], totalFacts: number): number {
    if (totalFacts === 0) return 100;

    let penalty = 0;
    for (const c of contradictions) {
      const weight = c.score / 100;
      switch (c.severity) {
        case 'critical':
          penalty += 30 * weight;
          break;
        case 'warning':
          penalty += 15 * weight;
          break;
        case 'possible':
          penalty += 5 * weight;
          break;
      }
    }

    const maxPenalty = totalFacts * 2;
    return Math.max(0, Math.round(100 - (penalty / maxPenalty) * 100));
  }
}
