export function permissionMatches(pattern: string, permission: string): boolean {
  if (pattern === permission) return true;
  const patternParts = pattern.split(':');
  const permParts = permission.split(':');

  for (let i = 0; i < Math.max(patternParts.length, permParts.length); i++) {
    const p = patternParts[i];
    const v = permParts[i];
    if (p === undefined) return false;
    if (p === '*') return true;
    if (v === undefined) return false;
    if (p !== v) return false;
  }
  return true;
}

export function isAllowedByWildcard(required: string, granted: Set<string>): boolean {
  if (granted.has(required)) return true;
  for (const pattern of granted) {
    if (pattern.includes('*') && permissionMatches(pattern, required)) return true;
  }
  return false;
}


