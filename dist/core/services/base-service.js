"use strict";
/**
 * Base Service Infrastructure for Lattice Core
 *
 * This file provides the foundational classes and interfaces that all services extend.
 * It includes standardized error handling, validation helpers, and
 * transaction management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = exports.ServiceError = void 0;
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
class ServiceError extends Error {
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ServiceError';
    }
    /**
     * Creates a "not found" error for when a resource doesn't exist
     * @param resource - The type of resource (e.g., 'User', 'Role')
     * @param id - The ID that was not found (optional)
     */
    static notFound(resource, id) {
        return new ServiceError(`${resource} not found${id ? ` with id: ${id}` : ''}`, 'NOT_FOUND', 404, { resource, id });
    }
    /**
     * Creates an "unauthorized" error for authentication failures
     * @param message - Custom error message (defaults to 'Unauthorized')
     */
    static unauthorized(message = 'Unauthorized') {
        return new ServiceError(message, 'UNAUTHORIZED', 401);
    }
    /**
     * Creates a "forbidden" error for authorization failures
     * @param message - Custom error message (defaults to 'Forbidden')
     */
    static forbidden(message = 'Forbidden') {
        return new ServiceError(message, 'FORBIDDEN', 403);
    }
    /**
     * Creates a "validation error" for invalid input data
     * @param message - Description of the validation failure
     * @param details - Additional validation details (optional)
     */
    static validationError(message, details) {
        return new ServiceError(message, 'VALIDATION_ERROR', 400, details);
    }
    /**
     * Creates a "conflict" error for resource conflicts (e.g., duplicate entries)
     * @param message - Description of the conflict
     * @param details - Additional conflict details (optional)
     */
    static conflict(message, details) {
        return new ServiceError(message, 'CONFLICT', 409, details);
    }
    /**
     * Creates an "internal error" for unexpected server errors
     * @param message - Custom error message (defaults to 'Internal server error')
     */
    static internal(message = 'Internal server error') {
        return new ServiceError(message, 'INTERNAL_ERROR', 500);
    }
}
exports.ServiceError = ServiceError;
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
class BaseService {
    /**
     * Constructor for BaseService
     * @param db - Prisma database client
     */
    constructor(db) {
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
    async withTransaction(operation) {
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
    async execute(operation, _params, _serviceContext) {
        return operation();
    }
    /**
     * Validates that a required value is not null or undefined
     * @param value - The value to validate
     * @param fieldName - Name of the field for error messages
     * @returns The validated value
     * @throws ServiceError.validationError if value is null or undefined
     */
    validateRequired(value, fieldName) {
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
    validateString(value, fieldName, minLength = 1) {
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
    validateEmail(email) {
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
    validateUUID(id, fieldName = 'id') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            throw ServiceError.validationError(`Invalid ${fieldName} format`);
        }
        return id;
    }
}
exports.BaseService = BaseService;
