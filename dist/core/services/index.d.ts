/**
 * Services Index - Lattice Core
 *
 * This file serves as the main entry point for all service-related exports.
 * It provides a centralized location for importing services, interfaces,
 * and related types, making it easier to manage dependencies and maintain
 * clean import statements throughout the application.
 *
 * Usage:
 * import { ServiceFactory, RoleService, ServiceError } from './services';
 * import type { IRoleService, ServiceContext, IServiceError } from './services';
 */
export * from './base-service';
export * from './interfaces';
export * from './context-service';
export * from './role-service';
export * from './user-permission-service';
export * from './user-service';
export * from './policy-service';
export * from './service-factory';
export type { User, Role, Permission, Context, UserRole, RolePermission, UserPermission, UserContext, RevokedToken, AbacPolicy, Prisma, } from '../db/db-client';
