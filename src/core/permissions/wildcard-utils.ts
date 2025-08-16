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
  console.log('🔍 [WILDCARD_MATCH] Checking if pattern matches permission');
  console.log('🔍 [WILDCARD_MATCH] Pattern:', pattern);
  console.log('🔍 [WILDCARD_MATCH] Permission:', permission);
  
  // Exact match
  if (pattern === permission) {
    console.log('🔍 [WILDCARD_MATCH] ✅ Exact match found');
    return true;
  }
  
  const patternParts = pattern.split(':');
  const permParts = permission.split(':');
  
  console.log('🔍 [WILDCARD_MATCH] Pattern parts:', patternParts);
  console.log('🔍 [WILDCARD_MATCH] Permission parts:', permParts);

  // Check each part of the permission
  for (let i = 0; i < Math.max(patternParts.length, permParts.length); i++) {
    const patternPart = patternParts[i];
    const permPart = permParts[i];
    
    console.log(`🔍 [WILDCARD_MATCH] Checking part ${i}: patternPart="${patternPart}", permPart="${permPart}"`);
    
    // If pattern part is undefined, no match
    if (patternPart === undefined) {
      console.log('🔍 [WILDCARD_MATCH] ❌ Pattern part undefined - no match');
      return false;
    }
    
    // If pattern part is wildcard, match everything
    if (patternPart === '*') {
      console.log('🔍 [WILDCARD_MATCH] ✅ Wildcard found - matching everything');
      return true;
    }
    
    // If permission part is undefined, no match
    if (permPart === undefined) {
      console.log('🔍 [WILDCARD_MATCH] ❌ Permission part undefined - no match');
      return false;
    }
    
    // If parts don't match exactly, no match
    if (patternPart !== permPart) {
      console.log('🔍 [WILDCARD_MATCH] ❌ Parts don\'t match exactly - no match');
      return false;
    }
  }
  
  console.log('🔍 [WILDCARD_MATCH] ✅ All parts matched - returning true');
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
  console.log('🎯 [IS_ALLOWED_BY_WILDCARD] Starting isAllowedByWildcard check');
  console.log('🎯 [IS_ALLOWED_BY_WILDCARD] Required permission:', required);
  console.log('🎯 [IS_ALLOWED_BY_WILDCARD] Granted permissions:', Array.from(granted));
  
  // Check for exact match first
  if (granted.has(required)) {
    console.log('🎯 [IS_ALLOWED_BY_WILDCARD] ✅ Exact match found');
    return true;
  }
  
  console.log('🎯 [IS_ALLOWED_BY_WILDCARD] No exact match, checking wildcard patterns...');
  
  // Check for wildcard matches
  for (const pattern of granted) {
    console.log('🎯 [IS_ALLOWED_BY_WILDCARD] Checking pattern:', pattern);
    
    if (pattern.includes('*')) {
      console.log('🎯 [IS_ALLOWED_BY_WILDCARD] Pattern contains wildcard, checking if it matches...');
      const matches = permissionMatches(pattern, required);
      console.log('🎯 [IS_ALLOWED_BY_WILDCARD] permissionMatches result:', matches);
      
      if (matches) {
        console.log('🎯 [IS_ALLOWED_BY_WILDCARD] ✅ Wildcard pattern matched');
        return true;
      }
    } else {
      console.log('🎯 [IS_ALLOWED_BY_WILDCARD] Pattern does not contain wildcard, skipping');
    }
  }
  
  console.log('🎯 [IS_ALLOWED_BY_WILDCARD] ❌ No matches found - access denied');
  return false;
}


