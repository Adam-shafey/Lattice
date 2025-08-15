/**
 * Base Service Infrastructure for Lattice Core
 * 
 * This file provides the foundational classes and interfaces that all services extend.
 * It includes standardized error handling, validation helpers, audit logging, and
 * transaction management.
 */

import { db as PrismaClient, type Prisma } from '../db/db-client';
import type { PrismaClient as PrismaClientType } from '../../../prisma/generated/client';

// Define audit interface to avoid circular dependency
export interface AuditServiceInterface {
  log(params: {
    actorId?: string | null;
    targetUserId?: string | null;
    contextId?: string | null;
    action: string;
    success: boolean;
    requestId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    plugin?: string | null;
    error?: string | null;
    metadata?: unknown;
  }): Promise<void>;
}

/**
 * Service Context Interface
 * 
 * Provides contextual information about the current operation, including:
 * - actorId: The user/system performing the action
 * - source: Where the action originated (e.g., 'api', 'cli', 'plugin')
 * - reason: Optional reason for the action
 * - requestId: Unique identifier for the request (for tracing)
 * - ip: Client IP address (for security auditing)
 * - userAgent: Client user agent (for security auditing)
 */
export interface ServiceContext {
  actorId?: string | null;
  source?: string;
  reason?: string;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Service Error Interface
 * 
 * Extends the standard Error interface with additional properties for
 * consistent error handling across all services.
 */
export interface ServiceError extends Error {
  code: string;           // Machine-readable error code
  statusCode: number;     // HTTP status code
  details?: Record<string, unknown>; // Additional error details
}

/**
 * ServiceError Class
 * 
 * Standardized error handling for all services. Provides factory methods
 * for common error types with consistent error codes and messages.
 * 
 * Usage:
 * - ServiceError.notFound('User', 'user_123')
 * - ServiceError.validationError('Email is required')
 * - ServiceError.conflict('User already exists')
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }

  /**
   * Creates a "not found" error for when a resource doesn't exist
   * @param resource - The type of resource (e.g., 'User', 'Role')
   * @param id - The ID that was not found (optional)
   */
  static notFound(resource: string, id?: string): ServiceError {
    return new ServiceError(
      `${resource} not found${id ? ` with id: ${id}` : ''}`,
      'NOT_FOUND',
      404,
      { resource, id }
    );
  }

  /**
   * Creates an "unauthorized" error for authentication failures
   * @param message - Custom error message (defaults to 'Unauthorized')
   */
  static unauthorized(message: string = 'Unauthorized'): ServiceError {
    return new ServiceError(message, 'UNAUTHORIZED', 401);
  }

  /**
   * Creates a "forbidden" error for authorization failures
   * @param message - Custom error message (defaults to 'Forbidden')
   */
  static forbidden(message: string = 'Forbidden'): ServiceError {
    return new ServiceError(message, 'FORBIDDEN', 403);
  }

  /**
   * Creates a "validation error" for invalid input data
   * @param message - Description of the validation failure
   * @param details - Additional validation details (optional)
   */
  static validationError(message: string, details?: Record<string, unknown>): ServiceError {
    return new ServiceError(message, 'VALIDATION_ERROR', 400, details);
  }

  /**
   * Creates a "conflict" error for resource conflicts (e.g., duplicate entries)
   * @param message - Description of the conflict
   * @param details - Additional conflict details (optional)
   */
  static conflict(message: string, details?: Record<string, unknown>): ServiceError {
    return new ServiceError(message, 'CONFLICT', 409, details);
  }

  /**
   * Creates an "internal error" for unexpected server errors
   * @param message - Custom error message (defaults to 'Internal server error')
   */
  static internal(message: string = 'Internal server error'): ServiceError {
    return new ServiceError(message, 'INTERNAL_ERROR', 500);
  }
}

/**
 * BaseService Abstract Class
 * 
 * Abstract base class that all services extend. Provides common functionality:
 * - Database client access
 * - Audit service integration
 * - Transaction management
 * - Input validation helpers
 * - Standardized audit logging
 * 
 * All services should extend this class to ensure consistency in:
 * - Error handling
 * - Audit logging
 * - Input validation
 * - Transaction management
 */
export abstract class BaseService {
  /** Database client for all database operations */
  protected readonly db: PrismaClientType;
  
  /** Audit service for logging all operations */
  protected readonly audit: AuditServiceInterface;

  /**
   * Constructor for BaseService
   * @param db - Prisma database client
   * @param audit - Audit service instance
   */
  constructor(
    db: PrismaClientType,
    audit: AuditServiceInterface
  ) {
    this.db = db;
    this.audit = audit;
  }

  /**
   * Executes a database operation within a transaction
   * 
   * This method ensures that all database operations within the provided
   * function are executed atomically. If any operation fails, all changes
   * are rolled back.
   * 
   * @param operation - Function containing database operations
   * @returns Promise that resolves to the result of the operation
   * 
   * Usage:
   * await this.withTransaction(async (tx) => {
   *   await tx.user.create({ data: userData });
   *   await tx.userRole.create({ data: roleData });
   * });
   */
  protected async withTransaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    return this.db.$transaction(operation);
  }

  /**
   * Executes an operation with automatic audit logging
   * 
   * This method wraps any operation with automatic audit logging. It logs
   * both successful operations and failures, providing a complete audit trail.
   * 
   * @param operation - The operation to execute and audit
   * @param auditParams - Parameters for audit logging
   * @param serviceContext - Optional service context for additional audit info
   * @returns Promise that resolves to the result of the operation
   * 
   * Usage:
   * return this.withAudit(
   *   async () => { // operation logic },
   *   {
   *     action: 'user.created',
   *     success: true,
   *     targetUserId: userId,
   *     resourceType: 'user',
   *     resourceId: userId
   *   },
   *   serviceContext
   * );
   */
  protected async withAudit<T>(
    operation: () => Promise<T>,
    auditParams: {
      action: string;           // The action being performed (e.g., 'user.created')
      success: boolean;         // Whether the operation succeeded
      contextId?: string | null; // Context ID if applicable
      targetUserId?: string | null; // Target user ID if applicable
      resourceType?: string | null; // Type of resource being acted upon
      resourceId?: string | null;   // ID of the resource being acted upon
      plugin?: string | null;   // Plugin name if applicable
      error?: string | null;    // Error message if operation failed
      metadata?: unknown;       // Additional metadata
    },
    serviceContext?: ServiceContext
  ): Promise<T> {
    try {
      // Execute the operation
      const result = await operation();
      
      // Log successful operation
      await this.audit.log({
        actorId: serviceContext?.actorId ?? null,
        targetUserId: auditParams.targetUserId ?? null,
        contextId: auditParams.contextId ?? null,
        action: auditParams.action,
        success: true,
        requestId: serviceContext?.requestId ?? null,
        ip: serviceContext?.ip ?? null,
        userAgent: serviceContext?.userAgent ?? null,
        resourceType: auditParams.resourceType ?? null,
        resourceId: auditParams.resourceId ?? null,
        plugin: auditParams.plugin ?? null,
        metadata: auditParams.metadata,
      });
      
      return result;
    } catch (error) {
      // Log failed operation
      await this.audit.log({
        actorId: serviceContext?.actorId ?? null,
        targetUserId: auditParams.targetUserId ?? null,
        contextId: auditParams.contextId ?? null,
        action: auditParams.action,
        success: false,
        requestId: serviceContext?.requestId ?? null,
        ip: serviceContext?.ip ?? null,
        userAgent: serviceContext?.userAgent ?? null,
        resourceType: auditParams.resourceType ?? null,
        resourceId: auditParams.resourceId ?? null,
        plugin: auditParams.plugin ?? null,
        error: error instanceof Error ? error.message : String(error),
        metadata: auditParams.metadata,
      });
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Validates that a required value is not null or undefined
   * @param value - The value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated value
   * @throws ServiceError.validationError if value is null or undefined
   */
  protected validateRequired<T>(value: T | null | undefined, fieldName: string): T {
    if (value == null) {
      throw ServiceError.validationError(`${fieldName} is required`);
    }
    return value;
  }

  /**
   * Validates that a value is a non-empty string
   * @param value - The value to validate
   * @param fieldName - Name of the field for error messages
   * @param minLength - Minimum length requirement (default: 1)
   * @returns The validated string
   * @throws ServiceError.validationError if validation fails
   */
  protected validateString(value: string | null | undefined, fieldName: string, minLength = 1): string {
    const str = this.validateRequired(value, fieldName);
    if (typeof str !== 'string' || str.length < minLength) {
      throw ServiceError.validationError(`${fieldName} must be a non-empty string`);
    }
    return str;
  }

  /**
   * Validates that a value is a valid email address
   * @param email - The email to validate
   * @returns The validated email
   * @throws ServiceError.validationError if email format is invalid
   */
  protected validateEmail(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw ServiceError.validationError('Invalid email format');
    }
    return email;
  }

  /**
   * Validates that a value is a valid UUID
   * @param id - The UUID to validate
   * @param fieldName - Name of the field for error messages (default: 'id')
   * @returns The validated UUID
   * @throws ServiceError.validationError if UUID format is invalid
   */
  protected validateUUID(id: string, fieldName: string = 'id'): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw ServiceError.validationError(`Invalid ${fieldName} format`);
    }
    return id;
  }
}
