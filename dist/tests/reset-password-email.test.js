"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const user_service_1 = require("../core/services/user-service");
const db_client_1 = require("../core/db/db-client");
class MockEmailAdapter {
    constructor() {
        this.sent = [];
    }
    async send(message) {
        this.sent.push(message);
    }
}
(0, vitest_1.describe)('UserService resetPassword', () => {
    let service;
    let mock;
    (0, vitest_1.beforeAll)(() => {
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    });
    (0, vitest_1.beforeEach)(async () => {
        mock = new MockEmailAdapter();
        service = new user_service_1.UserService(db_client_1.db, mock);
        await db_client_1.db.passwordResetToken.deleteMany();
        await db_client_1.db.user.deleteMany();
        await db_client_1.db.user.create({
            data: {
                id: 'u1',
                email: 'test@example.com',
                passwordHash: 'hash',
            },
        });
    });
    (0, vitest_1.it)('sends an email with reset token', async () => {
        await service.resetPassword('test@example.com');
        (0, vitest_1.expect)(mock.sent.length).toBe(1);
        (0, vitest_1.expect)(mock.sent[0].to).toBe('test@example.com');
    });
});
