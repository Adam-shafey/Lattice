import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { UserService } from '../core/services/user-service';
import { db } from '../core/db/db-client';
import type { EmailAdapter, EmailMessage } from '../core/services/email-adapter';

class MockEmailAdapter implements EmailAdapter {
  public sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe('UserService resetPassword', () => {
  let service: UserService;
  let mock: MockEmailAdapter;

  beforeAll(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  beforeEach(async () => {
    mock = new MockEmailAdapter();
    service = new UserService(db, mock);

    await db.passwordResetToken.deleteMany();
    await db.user.deleteMany();

    await db.user.create({
      data: {
        id: 'u1',
        email: 'test@example.com',
        passwordHash: 'hash',
      },
    });
  });

  it('sends an email with reset token', async () => {
    await service.resetPassword('test@example.com');
    expect(mock.sent.length).toBe(1);
    expect(mock.sent[0].to).toBe('test@example.com');
  });
});
