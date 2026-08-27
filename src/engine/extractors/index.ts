import { FactExtractor } from '../../types';
import { EnvironmentExtractor } from './environment';
import { RuntimeExtractor } from './runtime';
import { PackageJsonExtractor } from './packageJson';
import { DockerExtractor } from './docker';
import { DocumentationExtractor } from './documentation';
import { GitHubActionsExtractor } from './githubActions';

export const extractors: FactExtractor[] = [
  new EnvironmentExtractor(),
  new RuntimeExtractor(),
  new PackageJsonExtractor(),
  new DockerExtractor(),
  new DocumentationExtractor(),
  new GitHubActionsExtractor(),
];
