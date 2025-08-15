/**
 * Checks if a permission matches a pattern with wildcard support
 * 
 * Supports wildcard patterns like:
 * - 'users:*' matches 'users:read', 'users:write', etc.
 * - 'org:123:*' matches 'org:123:read', 'org:123:write', etc.
 * - 'admin:*:delete' matches 'admin:users:delete', 'admin:roles:delete', etc.
 * 
 * @param pattern - The pattern to match against (may contain '*' wildcards)
 * @param permission - The permission string to check
 * @returns Boolean indicating if the permission matches the pattern
 */
export function permissionMatches(pattern: string, permission: string): boolean {
  // Exact match
  if (pattern === permission) {
    return true;
  }
  
  const patternParts = pattern.split(':');
  const permParts = permission.split(':');

  // Check each part of the permission
  for (let i = 0; i < Math.max(patternParts.length, permParts.length); i++) {
    const patternPart = patternParts[i];
    const permPart = permParts[i];
    
    // If pattern part is undefined, no match
    if (patternPart === undefined) {
      return false;
    }
    
    // If pattern part is wildcard, match everything
    if (patternPart === '*') {
      return true;
    }
    
    // If permission part is undefined, no match
    if (permPart === undefined) {
      return false;
    }
    
    // If parts don't match exactly, no match
    if (patternPart !== permPart) {
      return false;
    }
  }
  
  return true;
}

/**
 * Checks if a required permission is allowed given a set of granted permissions
 * 
 * This function checks both exact matches and wildcard patterns. For example:
 * - If user has 'users:*' and required is 'users:read' → allowed
 * - If user has 'admin:users:delete' and required is 'admin:users:delete' → allowed
 * - If user has 'users:read' and required is 'users:write' → not allowed
 * 
 * @param required - The permission key being checked
 * @param granted - Set of permission keys the user has (may include wildcards)
 * @returns Boolean indicating if the required permission is allowed
 */
export function isAllowedByWildcard(required: string, granted: Set<string>): boolean {
  // Check for exact match first
  if (granted.has(required)) {
    return true;
  }
  
  // Check for wildcard matches
  for (const pattern of granted) {
    if (pattern.includes('*') && permissionMatches(pattern, required)) {
      return true;
    }
  }
  
  return false;
}


