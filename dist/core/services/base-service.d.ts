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
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;
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
export declare class ServiceError extends Error implements IServiceError {
    code: string;
    statusCode: number;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: Record<string, unknown> | undefined);
    /**
     * Creates a "not found" error for when a resource doesn't exist
     * @param resource - The type of resource (e.g., 'User', 'Role')
     * @param id - The ID that was not found (optional)
     */
    static notFound(resource: string, id?: string): ServiceError;
    /**
     * Creates an "unauthorized" error for authentication failures
     * @param message - Custom error message (defaults to 'Unauthorized')
     */
    static unauthorized(message?: string): ServiceError;
    /**
     * Creates a "forbidden" error for authorization failures
     * @param message - Custom error message (defaults to 'Forbidden')
     */
    static forbidden(message?: string): ServiceError;
    /**
     * Creates a "validation error" for invalid input data
     * @param message - Description of the validation failure
     * @param details - Additional validation details (optional)
     */
    static validationError(message: string, details?: Record<string, unknown>): ServiceError;
    /**
     * Creates a "conflict" error for resource conflicts (e.g., duplicate entries)
     * @param message - Description of the conflict
     * @param details - Additional conflict details (optional)
     */
    static conflict(message: string, details?: Record<string, unknown>): ServiceError;
    /**
     * Creates an "internal error" for unexpected server errors
     * @param message - Custom error message (defaults to 'Internal server error')
     */
    static internal(message?: string): ServiceError;
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
export declare abstract class BaseService {
    /** Database client for all database operations */
    protected readonly db: PrismaClient;
    /**
     * Constructor for BaseService
     * @param db - Prisma database client
     */
    constructor(db: PrismaClient);
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
    protected withTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
    /**
     * Executes an operation.
     *
     * @param operation - The operation to execute
     * @param _params - Legacy parameter, ignored
     * @param _serviceContext - Legacy parameter, ignored
    * @returns Promise that resolves to the result of the operation
    */
    protected execute<T>(operation: () => Promise<T>, _params?: unknown, _serviceContext?: ServiceContext): Promise<T>;
    /**
     * Validates that a required value is not null or undefined
     * @param value - The value to validate
     * @param fieldName - Name of the field for error messages
     * @returns The validated value
     * @throws ServiceError.validationError if value is null or undefined
     */
    protected validateRequired<T>(value: T | null | undefined, fieldName: string): T;
    /**
     * Validates that a value is a non-empty string
     * @param value - The value to validate
     * @param fieldName - Name of the field for error messages
     * @param minLength - Minimum length requirement (default: 1)
     * @returns The validated string
     * @throws ServiceError.validationError if validation fails
     */
    protected validateString(value: string | null | undefined, fieldName: string, minLength?: number): string;
    /**
     * Validates that a value is a valid email address
     * @param email - The email to validate
     * @returns The validated email
     * @throws ServiceError.validationError if email format is invalid
     */
    protected validateEmail(email: string): string;
    /**
     * Validates that a value is a valid UUID
     * @param id - The UUID to validate
     * @param fieldName - Name of the field for error messages (default: 'id')
     * @returns The validated UUID
     * @throws ServiceError.validationError if UUID format is invalid
     */
    protected validateUUID(id: string, fieldName?: string): string;
}
