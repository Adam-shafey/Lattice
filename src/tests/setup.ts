import path from 'path';

const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
