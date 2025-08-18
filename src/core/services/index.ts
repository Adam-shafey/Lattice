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

// Base service infrastructure
// Exports the foundational classes and interfaces that all services extend
export * from './base-service';

// Service interfaces
// Exports TypeScript interfaces that define contracts for all services
// These interfaces enable type safety, testing, and clear API documentation
export * from './interfaces';

// Service implementations
// Exports the concrete service classes that implement the interfaces
// Each service extends BaseService and provides specific business logic
export * from './context-service';
export * from './role-service';
export * from './user-permission-service';
export * from './user-service';
export * from './policy-service';

// Service factory
// Exports the factory pattern implementation for creating and managing services
// The factory provides dependency injection, lazy loading, and lifecycle management
export * from './service-factory';

// Re-export database types for convenience
// Exports Prisma-generated types and database-related interfaces
// This allows consumers to import both services and database types from one location
export type {
  User,
  Role,
  Permission,
  Context,
  UserRole,
  RolePermission,
  UserContext,
  RevokedToken,
  AbacPolicy,
  Prisma,
} from '../db/db-client';
