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
export declare function permissionMatches(pattern: string, permission: string): boolean;
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
export declare function isAllowedByWildcard(required: string, granted: Set<string>): boolean;
