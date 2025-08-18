/**
 * User Service for Lattice Core
 *
 * This service manages user operations including:
 * - User creation and authentication
 * - User profile management
 * - Password management
 * - User listing and search
 *
 * The service extends BaseService to inherit common functionality like
 * validation and transaction management.
 */
import { BaseService, type ServiceContext } from './base-service';
import { IUserService } from './interfaces';
import type { PrismaClient, User } from '../db/db-client';
type SafeUser = Omit<User, 'passwordHash'>;
/**
 * UserService Class
 *
 * Implements the IUserService interface and provides all user-related
 * operations. Extends BaseService to inherit common functionality.
 */
export declare class UserService extends BaseService implements IUserService {
    constructor(db: PrismaClient);
    /**
     * Creates a new user with the specified email and password
     *
     * @param params.email - The user's email address
     * @param params.password - The user's password (will be hashed)
     * @param params.context - Optional service context
     * @returns Promise resolving to the created User
     *
     * @throws ServiceError.validationError if email or password are invalid
     * @throws ServiceError.conflict if user with email already exists
     */
    createUser(params: {
        email: string;
        password: string;
        context?: ServiceContext;
    }): Promise<User>;
    /**
     * Retrieves a user by their unique ID
     *
     * @param id - The user's unique identifier
     * @param context - Optional service context
     * @returns Promise resolving to User or null if not found
     */
    getUserById(id: string, context?: ServiceContext): Promise<SafeUser | null>;
    /**
     * Retrieves a user by their email address
     *
     * @param email - The user's email address
     * @param context - Optional service context
     * @returns Promise resolving to User or null if not found
     */
    getUserByEmail(email: string, context?: ServiceContext): Promise<SafeUser | null>;
    /**
     * Updates a user's profile information
     *
     * @param id - The user's unique identifier
     * @param updates - Object containing fields to update
     * @param context - Optional service context
     * @returns Promise resolving to the updated User
     *
     * @throws ServiceError.notFound if user doesn't exist
     * @throws ServiceError.validationError if updates are invalid
     * @throws ServiceError.conflict if email already exists
     */
    updateUser(id: string, updates: {
        email?: string;
        password?: string;
    }, context?: ServiceContext): Promise<SafeUser>;
    /**
     * Permanently deletes a user and all associated data
     *
     * @param id - The user's unique identifier
     * @param context - Optional service context
     * @returns Promise that resolves when deletion is complete
     *
     * @throws ServiceError.notFound if user doesn't exist
     */
    deleteUser(id: string, context?: ServiceContext): Promise<void>;
    /**
     * Lists users with optional pagination
     *
     * @param params.limit - Maximum number of users to return
     * @param params.offset - Number of users to skip (for pagination)
     * @param params.context - Optional service context
     * @returns Promise resolving to object containing users array and total count
     */
    listUsers(params?: {
        limit?: number;
        offset?: number;
        context?: ServiceContext;
    }): Promise<{
        users: SafeUser[];
        total: number;
    }>;
    /**
     * Verifies a user's password
     *
     * @param userId - The user's unique identifier
     * @param password - Password to verify
     * @returns Promise resolving to true if password is correct, false otherwise
     *
     * @throws ServiceError.notFound if user doesn't exist
     */
    verifyPassword(userId: string, password: string): Promise<boolean>;
    /**
     * Changes a user's password with old password verification
     *
     * @param userId - The user's unique identifier
     * @param oldPassword - Current password for verification
     * @param newPassword - New password to set
     * @param context - Optional service context
     * @returns Promise that resolves when password is changed
     *
     * @throws ServiceError.notFound if user doesn't exist
     * @throws ServiceError.unauthorized if old password is incorrect
     * @throws ServiceError.validationError if new password is invalid
     */
    changePassword(userId: string, oldPassword: string, newPassword: string, context?: ServiceContext): Promise<void>;
}
export {};
