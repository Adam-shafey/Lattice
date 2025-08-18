"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionMatches = permissionMatches;
exports.isAllowedByWildcard = isAllowedByWildcard;
const logger_1 = require("../logger");
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
function permissionMatches(pattern, permission) {
    logger_1.logger.log('🔍 [WILDCARD_MATCH] Checking if pattern matches permission');
    logger_1.logger.log('🔍 [WILDCARD_MATCH] Pattern:', pattern);
    logger_1.logger.log('🔍 [WILDCARD_MATCH] Permission:', permission);
    // Exact match
    if (pattern === permission) {
        logger_1.logger.log('🔍 [WILDCARD_MATCH] ✅ Exact match found');
        return true;
    }
    const patternParts = pattern.split(':');
    const permParts = permission.split(':');
    logger_1.logger.log('🔍 [WILDCARD_MATCH] Pattern parts:', patternParts);
    logger_1.logger.log('🔍 [WILDCARD_MATCH] Permission parts:', permParts);
    // Check each part of the permission
    for (let i = 0; i < Math.max(patternParts.length, permParts.length); i++) {
        const patternPart = patternParts[i];
        const permPart = permParts[i];
        logger_1.logger.log(`🔍 [WILDCARD_MATCH] Checking part ${i}: patternPart="${patternPart}", permPart="${permPart}"`);
        // If pattern part is undefined, no match
        if (patternPart === undefined) {
            logger_1.logger.log('🔍 [WILDCARD_MATCH] ❌ Pattern part undefined - no match');
            return false;
        }
        // If pattern part is wildcard, match everything
        if (patternPart === '*') {
            logger_1.logger.log('🔍 [WILDCARD_MATCH] ✅ Wildcard found - matching everything');
            return true;
        }
        // If permission part is undefined, no match
        if (permPart === undefined) {
            logger_1.logger.log('🔍 [WILDCARD_MATCH] ❌ Permission part undefined - no match');
            return false;
        }
        // If parts don't match exactly, no match
        if (patternPart !== permPart) {
            logger_1.logger.log('🔍 [WILDCARD_MATCH] ❌ Parts don\'t match exactly - no match');
            return false;
        }
    }
    logger_1.logger.log('🔍 [WILDCARD_MATCH] ✅ All parts matched - returning true');
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
function isAllowedByWildcard(required, granted) {
    logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] Starting isAllowedByWildcard check');
    logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] Required permission:', required);
    logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] Granted permissions:', Array.from(granted));
    // Check for exact match first
    if (granted.has(required)) {
        logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] ✅ Exact match found');
        return true;
    }
    logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] No exact match, checking wildcard patterns...');
    // Check for wildcard matches
    for (const pattern of granted) {
        logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] Checking pattern:', pattern);
        if (pattern.includes('*')) {
            logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] Pattern contains wildcard, checking if it matches...');
            const matches = permissionMatches(pattern, required);
            logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] permissionMatches result:', matches);
            if (matches) {
                logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] ✅ Wildcard pattern matched');
                return true;
            }
        }
        else {
            logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] Pattern does not contain wildcard, skipping');
        }
    }
    logger_1.logger.log('🎯 [IS_ALLOWED_BY_WILDCARD] ❌ No matches found - access denied');
    return false;
}
