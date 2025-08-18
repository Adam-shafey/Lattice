/**
 * Base Service Infrastructure for Lattice Core
 * 
 * This file provides the foundational classes and interfaces that all services extend.
 * It includes standardized error handling, validation helpers, and
 * transaction management.
 */

import type { PrismaClient, Prisma } from '../db/db-client';

/**
 * Service Context Interface
 * 
 * Provides contextual information about the current operation, including:
 * - actorId: The user/system performing the action
 * - source: Where the action originated (e.g., 'api', 'cli', 'plugin')
 * - reason: Optional reason for the action
 * - requestId: Unique identifier for the request (for tracing)
 * - ip: Client IP address (optional)
 * - userAgent: Client user agent (optional)
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
 * IServiceError Interface
 *
 * Extends the standard Error interface with additional properties for
 * consistent error handling across all services.
 */
export interface IServiceError extends Error {
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
export class ServiceError extends Error implements IServiceError {
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
 * - Transaction management
 * - Input validation helpers
 *
 * All services should extend this class to ensure consistency in:
 * - Error handling
 * - Input validation
 * - Transaction management
 */
export abstract class BaseService {
  /** Database client for all database operations */
  protected readonly db: PrismaClient;

  /**
   * Constructor for BaseService
   * @param db - Prisma database client
   */
  constructor(db: PrismaClient) {
    this.db = db;
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
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.db.$transaction(operation);
  }

  /**
   * Executes an operation.
   *
   * @param operation - The operation to execute
   * @param _params - Legacy parameter, ignored
   * @param _serviceContext - Legacy parameter, ignored
  * @returns Promise that resolves to the result of the operation
  */
  protected async execute<T>(
    operation: () => Promise<T>,
    _params?: unknown,
    _serviceContext?: ServiceContext
  ): Promise<T> {
    return operation();
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
