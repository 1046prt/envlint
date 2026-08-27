import { Fact, FactGroup, FactCategory } from '../types';
import { randomUUID } from 'crypto';

export class FactStore {
  private facts: Map<string, Fact> = new Map();

  addFact(fact: Omit<Fact, 'id'>): Fact {
    const id = randomUUID();
    const fullFact = { ...fact, id };
    this.facts.set(id, fullFact);
    return fullFact;
  }

  addFacts(facts: Omit<Fact, 'id'>[]): Fact[] {
    return facts.map(f => this.addFact(f));
  }

  getFactsByCategory(category: FactCategory): Fact[] {
    return Array.from(this.facts.values()).filter(f => f.category === category);
  }

  getFactsByTechnology(technology: string): Fact[] {
    return Array.from(this.facts.values()).filter(
      f => f.technology.toLowerCase() === technology.toLowerCase()
    );
  }

  getFactGroups(): FactGroup[] {
    const groups = new Map<string, FactGroup>();
    
    for (const fact of this.facts.values()) {
      const key = `${fact.category}:${fact.technology}`;
      if (!groups.has(key)) {
        groups.set(key, {
          category: fact.category,
          technology: fact.technology,
          facts: [],
        });
      }
      groups.get(key)!.facts.push(fact);
    }

    return Array.from(groups.values());
  }

  getAllFacts(): Fact[] {
    return Array.from(this.facts.values());
  }

  clear(): void {
    this.facts.clear();
  }

  get size(): number {
    return this.facts.size;
  }
}
