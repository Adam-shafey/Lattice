"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Base service infrastructure
// Exports the foundational classes and interfaces that all services extend
__exportStar(require("./base-service"), exports);
// Service interfaces
// Exports TypeScript interfaces that define contracts for all services
// These interfaces enable type safety, testing, and clear API documentation
__exportStar(require("./interfaces"), exports);
// Service implementations
// Exports the concrete service classes that implement the interfaces
// Each service extends BaseService and provides specific business logic
__exportStar(require("./context-service"), exports);
__exportStar(require("./role-service"), exports);
__exportStar(require("./user-permission-service"), exports);
__exportStar(require("./user-service"), exports);
__exportStar(require("./policy-service"), exports);
// Service factory
// Exports the factory pattern implementation for creating and managing services
// The factory provides dependency injection, lazy loading, and lifecycle management
__exportStar(require("./service-factory"), exports);
