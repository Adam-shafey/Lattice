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

import { BaseService, ServiceError, type ServiceContext } from './base-service';
import { IUserService } from './interfaces';
import type { User } from '../db/db-client';
import { hash, compare } from 'bcryptjs';
import { randomUUID } from 'crypto';

type SafeUser = Omit<User, 'passwordHash'>;

const safeUserSelect = {
  id: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * UserService Class
 * 
 * Implements the IUserService interface and provides all user-related
 * operations. Extends BaseService to inherit common functionality.
 */
export class UserService extends BaseService implements IUserService {
  constructor(db: any) {
    super(db);
  }
  
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
  async createUser(params: {
    email: string;
    password: string;
    context?: ServiceContext;
  }): Promise<User> {
    const { email, password, context: serviceContext } = params;

    // Validate inputs
    this.validateEmail(email);
    this.validateString(password, 'password');
    
    if (password.length < 8) {
      throw ServiceError.validationError('Password must be at least 8 characters long');
    }

    return this.execute(
      async () => {
        // Check if user with email already exists
        const existing = await this.db.user.findUnique({ where: { email } });
        if (existing) {
          throw ServiceError.conflict(`User with email '${email}' already exists`);
        }

        // Hash the password
        const hashedPassword = await hash(password, 12);

        // Create the user
        const user = await this.db.user.create({
          data: {
            id: randomUUID(),
            email,
            passwordHash: hashedPassword,
          },
        });

        return user;
      },
      {
        action: 'user.created',
        success: true,
        resourceType: 'user',
        resourceId: email,
        metadata: { email },
      },
      serviceContext
    );
  }

  /**
   * Retrieves a user by their unique ID
   * 
   * @param id - The user's unique identifier
   * @param context - Optional service context
   * @returns Promise resolving to User or null if not found
   */
  async getUserById(id: string, context?: ServiceContext): Promise<SafeUser | null> {
    this.validateString(id, 'user id');

    return this.execute(
      async () => {
        return this.db.user.findUnique({ where: { id }, select: safeUserSelect });
      },
      {
        action: 'user.read',
        success: true,
        resourceType: 'user',
        resourceId: id,
      },
      context
    );
  }

  /**
   * Retrieves a user by their email address
   * 
   * @param email - The user's email address
   * @param context - Optional service context
   * @returns Promise resolving to User or null if not found
   */
  async getUserByEmail(email: string, context?: ServiceContext): Promise<SafeUser | null> {
    this.validateEmail(email);

    return this.execute(
      async () => {
        return this.db.user.findUnique({ where: { email }, select: safeUserSelect });
      },
      {
        action: 'user.read',
        success: true,
        resourceType: 'user',
        resourceId: email,
      },
      context
    );
  }

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
  async updateUser(id: string, updates: {
    email?: string;
    password?: string;
  }, context?: ServiceContext): Promise<SafeUser> {
    this.validateString(id, 'user id');
    
    if (updates.email !== undefined) {
      this.validateEmail(updates.email);
    }
    if (updates.password !== undefined) {
      this.validateString(updates.password, 'password');
      if (updates.password.length < 8) {
        throw ServiceError.validationError('Password must be at least 8 characters long');
      }
    }

    return this.execute(
      async () => {
        // Check if user exists
        const existing = await this.db.user.findUnique({ where: { id } });
        if (!existing) {
          throw ServiceError.notFound('User', id);
        }

        // Check if email is being changed and if it already exists
        if (updates.email && updates.email !== existing.email) {
          const emailExists = await this.db.user.findUnique({ where: { email: updates.email } });
          if (emailExists) {
            throw ServiceError.conflict(`User with email '${updates.email}' already exists`);
          }
        }

        // Prepare update data
        const updateData: any = {};
        if (updates.email) updateData.email = updates.email;
        if (updates.password) {
          updateData.passwordHash = await hash(updates.password, 12);
        }

        // Update the user
        const user = await this.db.user.update({
          where: { id },
          data: updateData,
          select: safeUserSelect,
        });

        return user;
      },
      {
        action: 'user.updated',
        success: true,
        resourceType: 'user',
        resourceId: id,
        metadata: { updatedFields: Object.keys(updates) },
      },
      context
    );
  }

  /**
   * Permanently deletes a user and all associated data
   * 
   * @param id - The user's unique identifier
   * @param context - Optional service context
   * @returns Promise that resolves when deletion is complete
   * 
   * @throws ServiceError.notFound if user doesn't exist
   */
  async deleteUser(id: string, context?: ServiceContext): Promise<void> {
    this.validateString(id, 'user id');

    return this.execute(
      async () => {
        // Check if user exists
        const user = await this.db.user.findUnique({ where: { id } });
        if (!user) {
          throw ServiceError.notFound('User', id);
        }

        // Use transaction to ensure all related data is deleted
        await this.withTransaction(async (tx) => {
          // Delete user permissions
          await tx.userPermission.deleteMany({ where: { userId: id } });
          
          // Delete user roles
          await tx.userRole.deleteMany({ where: { userId: id } });
          
          // Delete user contexts
          await tx.userContext.deleteMany({ where: { userId: id } });
          
          // Delete revoked tokens
          await tx.revokedToken.deleteMany({ where: { userId: id } });
          
          // Delete password reset tokens
          await tx.passwordResetToken.deleteMany({ where: { userId: id } });
          
          // Finally delete the user
          await tx.user.delete({ where: { id } });
        });
      },
      {
        action: 'user.deleted',
        success: true,
        resourceType: 'user',
        resourceId: id,
        targetUserId: id,
      },
      context
    );
  }

  /**
   * Lists users with optional pagination
   * 
   * @param params.limit - Maximum number of users to return
   * @param params.offset - Number of users to skip (for pagination)
   * @param params.context - Optional service context
   * @returns Promise resolving to object containing users array and total count
   */
  async listUsers(params?: {
    limit?: number;
    offset?: number;
    context?: ServiceContext;
  }): Promise<{ users: SafeUser[]; total: number }> {
    const { limit = 100, offset = 0, context: serviceContext } = params || {};

    // Validate pagination parameters
    if (limit < 1 || limit > 1000) {
      throw ServiceError.validationError('Limit must be between 1 and 1000');
    }
    if (offset < 0) {
      throw ServiceError.validationError('Offset must be non-negative');
    }

    return this.execute(
      async () => {
        const [users, total] = await Promise.all([
          this.db.user.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            select: safeUserSelect,
          }),
          this.db.user.count(),
        ]);

        return { users, total };
      },
      {
        action: 'user.list',
        success: true,
        resourceType: 'user',
        metadata: { limit, offset },
      },
      serviceContext
    );
  }

  /**
   * Verifies a user's password
   * 
   * @param userId - The user's unique identifier
   * @param password - Password to verify
   * @returns Promise resolving to true if password is correct, false otherwise
   * 
   * @throws ServiceError.notFound if user doesn't exist
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    this.validateString(userId, 'user id');
    this.validateString(password, 'password');

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ServiceError.notFound('User', userId);
    }

    return compare(password, user.passwordHash);
  }

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
  async changePassword(userId: string, oldPassword: string, newPassword: string, context?: ServiceContext): Promise<void> {
    this.validateString(userId, 'user id');
    this.validateString(oldPassword, 'old password');
    this.validateString(newPassword, 'new password');
    
    if (newPassword.length < 8) {
      throw ServiceError.validationError('New password must be at least 8 characters long');
    }

    return this.execute(
      async () => {
        // Get user with password
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) {
          throw ServiceError.notFound('User', userId);
        }

        // Verify old password
        const isOldPasswordValid = await compare(oldPassword, user.passwordHash);
        if (!isOldPasswordValid) {
          throw ServiceError.unauthorized('Current password is incorrect');
        }

        // Hash new password
        const hashedNewPassword = await hash(newPassword, 12);

        // Update password
        await this.db.user.update({
          where: { id: userId },
          data: { passwordHash: hashedNewPassword },
        });
      },
      {
        action: 'user.password_changed',
        success: true,
        resourceType: 'user',
        resourceId: userId,
        targetUserId: userId,
      },
      context
    );
  }

}
