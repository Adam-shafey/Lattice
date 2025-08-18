# 🏗️ Lattice Core

> **The Foundation for Permission-First SaaS Applications**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.14-purple.svg)](https://www.prisma.io/)

Lattice Core is a production-ready, TypeScript-first authorization framework that provides the foundation for building secure, scalable SaaS applications. Built with modern best practices, it offers context-aware access control, comprehensive role management, and a powerful plugin architecture.

## ✨ Key Features

- 🔐 **Context-Aware Access Control** - Multi-tenant, hierarchical permission system
- 🎭 **Flexible Role Management** - RBAC with user-level permissions and wildcard support
- 🔌 **Plugin Architecture** - Extensible system for routes, contexts, and permissions
- 🛠️ **Developer Experience** - CLI tools, TypeScript types, hot-reloadable permissions
- 🚀 **Production Ready** - Standardized service layer with error handling and validation
- 🔄 **Adapter Agnostic** - Works with Fastify or Express via shared interface
- 📚 **Comprehensive APIs** - Built-in REST APIs with OpenAPI documentation
- 🧪 **Testing Ready** - Full test suite with end-to-end examples

## 🚀 Quick Start

### Installation

```bash
npm install @yourorg/lattice-core
```

### Basic Setup

```typescript
import { Lattice } from '@yourorg/lattice-core';

const app = Lattice({
  db: { 
    provider: 'postgres', 
    url: process.env.DATABASE_URL 
  },
  adapter: 'fastify', // or 'express'
  jwt: { 
    accessTTL: '15m', 
    refreshTTL: '7d',
    secret: process.env.JWT_SECRET 
  },
  apiPrefix: '/api/v1'
});

await app.listen(3000);
console.log('🚀 Lattice Core running on port 3000');
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/lattice"
JWT_SECRET="your-super-secret-jwt-key-here"
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
```

## 🏗️ Architecture

Lattice Core is built around a service-oriented architecture with clear separation of concerns:

```
/core
├── 🔐 auth/          # JWT, OAuth2, MFA, Social Login
├── 🗄️ db/            # Database client and connections
├── 🌐 http/          # HTTP adapters and API routes
├── 🔑 permissions/   # Permission registry and evaluation
├── 📋 policy/        # ABAC policies and conditions
├── ⚙️ services/      # Production-ready service layer
└── 🧪 tests/         # Comprehensive test suite
```

## 🔧 Core Services

### User Management
```typescript
// Create users with secure password hashing
const user = await app.userService.createUser({
  email: 'user@example.com',
  password: 'securepassword123',
  context: { actorId: 'system' }
});
```

### Role Management
```typescript
// Create and assign roles
const role = await app.roleService.createRole({
  name: 'admin',
  contextType: 'organization',
  context: { actorId: 'system' }
});

await app.roleService.assignRoleToUser({
  roleName: 'admin',
  userId: user.id,
  contextId: 'org_123',
  context: { actorId: 'admin_456' }
});
```

### Permission Management
```typescript
// Grant direct permissions to users
await app.permissionService.grantToUser({
  userId: user.id,
  permissionKey: 'users:read',
  contextId: 'org_123',
  context: { actorId: 'admin_456' }
});
```

## 🔌 Plugin System

Extend Lattice Core with plugins for domain-specific functionality:

```typescript
import TeamsPlugin from '@yourorg/lattice-plugin-teams';
import UploadsPlugin from '@yourorg/lattice-plugin-uploads';

app.registerPlugin(TeamsPlugin);
app.registerPlugin(UploadsPlugin);
```

Plugins automatically register:
- 📋 Permissions in the Permission Registry
- 🏢 Context types for multi-tenancy
- 🛣️ Routes with built-in authorization

## 🛡️ Access Control

### Context-Aware Authorization
```typescript
// Check access with context awareness
const hasAccess = await app.checkAccess({
  userId: 'user_123',
  context: { type: 'organization', id: 'org_456' },
  permission: 'users:read',
  scope: 'exact'
});
```

### ABAC Policies
```typescript
// Create attribute-based access control policies
await app.policyService.createPolicy({
  action: 'users:read',
  resource: 'user',
  condition: 'user.department == resource.department',
  effect: 'permit',
  context: { actorId: 'admin' }
});
```

## 🖥️ CLI Tools

Lattice Core includes a powerful CLI for management tasks:

```bash
# List all permissions
npx lattice list-permissions

# Create users
npx lattice users:create --email alice@example.com --password secret

# Check access
npx lattice check-access --userId user_123 --contextId ctx_1 --permission example:read

# Manage roles
npx lattice roles:create --name admin --contextType organization
npx lattice roles:assign --roleName admin --userId user_123 --contextId org_456
```

## 📚 API Documentation

Lattice Core provides comprehensive API documentation:

- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI Spec**: `http://localhost:3000/docs/json`

All endpoints include:
- 🔐 Authentication requirements
- 📝 Request/response schemas
- 🧪 Interactive testing
- ❌ Error documentation

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:auth
npm run test:e2e
```

## 🚀 Development

### Prerequisites
- Node.js 18+
- PostgreSQL or SQLite
- TypeScript 5.5+

### Setup
```bash
# Clone the repository
git clone https://github.com/Adam-shafey/lattice.git
cd lattice

# Install dependencies
npm install

# Set up database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run test         # Run test suite
npm run swagger:gen  # Generate API documentation
npm run cli          # Run CLI commands
```

## 📖 Documentation

- **[Developer Guide](docs/DEV_GUIDE.md)** - Complete development setup and workflow
- **[Service Usage Guide](docs/SERVICE_USAGE_GUIDE.md)** - Detailed service layer documentation
- **[Sample Usage](docs/SampleUsage.md)** - Real-world examples and patterns
- **[API Reference](docs/README.md)** - Comprehensive API documentation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Prisma](https://www.prisma.io/) for type-safe database access
- Powered by [Fastify](https://www.fastify.io/) and [Express](https://expressjs.com/) adapters
- Enhanced with [CEL](https://github.com/google/cel-js) for policy evaluation
- Documented with [OpenAPI](https://swagger.io/specification/) and Swagger UI

## 📞 Support

- 📧 **Email**: abdoshafey1@gmail.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/Adam-shafey/lattice/issues)
- 📖 **Documentation**: [docs/](docs/)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Adam-shafey/lattice/discussions)

---

<div align="center">
  <strong>Built with ❤️ for the open source community</strong>
</div>