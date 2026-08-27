import { getAuthority, SOURCE_AUTHORITY } from '../types';

describe('getAuthority', () => {
  it('returns 95 for .nvmrc', () => {
    expect(getAuthority('.nvmrc')).toBe(95);
  });

  it('returns 95 for .node-version', () => {
    expect(getAuthority('.node-version')).toBe(95);
  });

  it('returns 90 for package.json', () => {
    expect(getAuthority('package.json')).toBe(90);
  });

  it('returns 85 for Dockerfile', () => {
    expect(getAuthority('Dockerfile')).toBe(85);
  });

  it('returns 85 for .github/workflows/ci.yml', () => {
    expect(getAuthority('.github/workflows/ci.yml')).toBe(85);
  });

  it('returns 40 for README.md', () => {
    expect(getAuthority('README.md')).toBe(40);
  });

  it('returns 75 for .env', () => {
    expect(getAuthority('.env')).toBe(75);
  });

  it('returns 80 for .env.example', () => {
    expect(getAuthority('.env.example')).toBe(80);
  });

  it('returns default 50 for unknown files', () => {
    expect(getAuthority('unknown.xyz')).toBe(50);
  });

  it('returns 85 for nested docker-compose path', () => {
    expect(getAuthority('services/api/docker-compose.yml')).toBe(85);
  });
});
