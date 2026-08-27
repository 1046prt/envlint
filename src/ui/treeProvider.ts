import * as vscode from 'vscode';
import { FactGroup, Contradiction, Severity } from '../types';

interface TreeNode {
  label: string;
  severity?: Severity;
  children?: TreeNode[];
  contradiction?: Contradiction;
  group?: FactGroup;
  tooltip?: string;
}

export class EnvlintTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: FactGroup[] = [];
  private contradictions: Contradiction[] = [];
  private score: number = 100;

  update(groups: FactGroup[], contradictions: Contradiction[], score: number): void {
    this.groups = groups;
    this.contradictions = contradictions;
    this.score = score;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);

    if (element.children) {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    if (element.contradiction) {
      item.description = element.contradiction.description;
      item.tooltip = this.getContradictionTooltip(element.contradiction);

      switch (element.contradiction.severity) {
        case 'critical':
          item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
          break;
        case 'warning':
          item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
          break;
        case 'possible':
          item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.yellow'));
          break;
      }

      if (element.contradiction.sources.length > 0) {
        item.command = {
          command: 'vscode.open',
          title: 'Open',
          arguments: [
            vscode.Uri.file(element.contradiction.sources[0].source.file),
            {
              selection: new vscode.Range(
                new vscode.Position(element.contradiction.sources[0].source.line - 1, 0),
                new vscode.Position(element.contradiction.sources[0].source.line - 1, 100)
              ),
            },
          ],
        };
      }
    } else if (element.group) {
      item.description = `${element.group.facts.length} facts`;
      item.iconPath = new vscode.ThemeIcon('checklist', new vscode.ThemeColor('charts.green'));
    } else {
      item.description = `${this.score}%`;
      if (this.score >= 90) {
        item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
      } else if (this.score >= 70) {
        item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
      } else {
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
      }
    }

    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return [
        {
          label: 'Project Consistency',
          children: this.getRootNodes(),
        },
      ];
    }
    return element.children || [];
  }

  private getRootNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];
    const critical = this.contradictions.filter(c => c.severity === 'critical');
    const warnings = this.contradictions.filter(c => c.severity === 'warning');
    const possible = this.contradictions.filter(c => c.severity === 'possible');

    // Determine overall status message
    let statusMessage: string;
    let statusIcon: vscode.ThemeIcon;
    
    if (this.contradictions.length === 0) {
      statusMessage = '✅ No contradictions detected — project is consistent';
      statusIcon = new vscode.ThemeIcon('pass');
    } else if (this.score >= 90) {
      statusMessage = `✅ Project consistent (${this.score}%) — ${this.contradictions.length} minor issue${this.contradictions.length !== 1 ? 's' : ''}`;
      statusIcon = new vscode.ThemeIcon('pass');
    } else if (this.score >= 70) {
      statusMessage = `⚠️ Project has inconsistencies (${this.score}%) — ${this.contradictions.length} issue${this.contradictions.length !== 1 ? 's' : ''} detected`;
      statusIcon = new vscode.ThemeIcon('warning');
    } else {
      statusMessage = `❌ Project has significant inconsistencies (${this.score}%) — ${this.contradictions.length} issue${this.contradictions.length !== 1 ? 's' : ''} need attention`;
      statusIcon = new vscode.ThemeIcon('error');
    }

    // Score node
    nodes.push({
      label: `Score: ${this.score}%`,
      tooltip: statusMessage,
      severity: this.score >= 90 ? 'consistent' : this.score >= 70 ? 'warning' : 'critical',
      children: [
        {
          label: `Critical: ${critical.length}`,
          severity: 'critical',
          children: critical.map(c => ({ label: `[${c.ruleId}] ${c.title}`, contradiction: c })),
        },
        {
          label: `Warnings: ${warnings.length}`,
          severity: 'warning',
          children: warnings.map(c => ({ label: `[${c.ruleId}] ${c.title}`, contradiction: c })),
        },
        {
          label: `Possible: ${possible.length}`,
          severity: 'possible',
          children: possible.map(c => ({ label: `[${c.ruleId}] ${c.title}`, contradiction: c })),
        },
      ],
    });

    // Consistent groups when score is high but some contradictions exist
    const consistentGroups = this.groups.filter(
      g => g.facts.length > 1 && new Set(g.facts.map(f => f.value)).size === 1
    );
    if (consistentGroups.length > 0 && this.score < 100) {
      nodes.push({
        label: `Consistent (${consistentGroups.length})`,
        children: consistentGroups.map(g => ({
          label: `${g.technology}: ${g.facts[0].value}`,
          group: g,
        })),
      });
    }

    // Category breakdown
    const byCategory = new Map<string, Contradiction[]>();
    for (const c of this.contradictions) {
      if (!byCategory.has(c.category)) {
        byCategory.set(c.category, []);
      }
      byCategory.get(c.category)!.push(c);
    }

    for (const [category, contradictions] of byCategory) {
      const label = category
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      nodes.push({
        label,
        children: contradictions.map(c => ({
          label: `[${c.ruleId}] ${c.title}`,
          contradiction: c,
          children: c.sources.map(s => ({
            label: `${s.source.file}:${s.source.line} → ${s.value} (${s.confidence}, auth:${s.authority})`,
          })),
        })),
      });
    }

    return nodes;
  }

  private getContradictionTooltip(c: Contradiction): string {
    let tooltip = `${c.ruleId}: ${c.title}\n\n`;
    tooltip += `${c.explanation}\n\n`;
    tooltip += `Score: ${c.score}/100  Confidence: ${c.confidence}%\n\n`;
    tooltip += `Sources:\n`;
    for (const s of c.sources) {
      tooltip += `  ${s.source.file}:${s.source.line} → ${s.value}`;
      tooltip += ` (confidence: ${s.confidence}, authority: ${s.authority})\n`;
    }
    return tooltip;
  }
}
