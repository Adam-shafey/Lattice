# Lattice Core

## Overview
Lattice Core is a TypeScript authorization framework providing RBAC/ABAC permissions, HTTP adapters (Fastify or Express), and a CLI for managing users, roles, and policies.

## Installation
```bash
npm install @yourorg/lattice-core
```

## Basic Usage
```ts
import { Lattice } from '@yourorg/lattice-core';

const app = Lattice({
  db: { provider: 'sqlite', url: 'file:./dev.db' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'dev-secret' }
});

await app.listen(3000);
```

## CLI Usage
The package exposes a `lattice` command for managing permissions and users. Examples:

```bash
npx lattice list-permissions
npx lattice users:create --email alice@example.com --password secret
```

Run `npx lattice help` to view all available commands.

## API Documentation
Generated Swagger documentation is available at [`src/swagger-output.json`](src/swagger-output.json). You can regenerate it with `npm run swagger:gen`.

## Contributing
1. Fork the repository and create your feature on a new branch.
2. Install dependencies with `npm install`.
3. Run `npm test` to ensure all tests pass.
4. Submit a pull request with a clear description of your changes.

