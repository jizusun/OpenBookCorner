# Technology Stack & Development Guidelines

## Core Technology Stack

### Frontend
- **Framework**: SvelteKit with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **UI Components**: shadcn-svelte (copy-paste, tree-shakeable components)
- **API Client**: tRPC-SvelteKit for type-safe API calls
- **PWA**: Built-in SvelteKit PWA capabilities with Service Worker
- **Camera**: Camera API for barcode scanning functionality

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono.js for edge-optimized HTTP handling
- **API**: tRPC with @hono/trpc-server integration
- **Authentication**: Lucia Auth for session management
- **ORM**: Drizzle ORM for type-safe database operations
- **Language**: TypeScript throughout

### Database & Storage
- **Primary Database**: Cloudflare D1 (SQLite-based)
- **Caching**: Cloudflare KV for sessions and temporary data
- **File Storage**: Cloudflare R2 for book cover images
- **External APIs**: Open Library API for book metadata

### Architecture Patterns
- **Domain-Driven Design**: Organized around bounded contexts (Library Management, Catalog Management, Circulation)
- **Multi-tenant**: Complete data isolation at application level
- **Event-Driven**: Domain events for cross-aggregate communication
- **CQRS**: Separate read/write models where beneficial

## Development Commands

### Setup & Installation
```bash
# Clone and install dependencies
git clone <repository-url>
cd OpenBookCorner
npm install

# Backend dependencies
cd worker && npm install && cd ..

# Environment setup
cp .env.example .env
cp worker/.env.example worker/.env
```

### Database Operations
```bash
# Create D1 database
npx wrangler d1 create openbookcorner

# Run migrations
cd worker && npm run db:migrate && cd ..

# Generate database types
cd worker && npm run db:generate && cd ..
```

### Development Servers
```bash
# Start frontend (port 5173)
npm run dev

# Start backend in separate terminal (port 8787)
cd worker && npm run dev
```

### Build & Deploy
```bash
# Build frontend
npm run build

# Deploy backend to Cloudflare Workers
cd worker && npm run deploy

# Deploy frontend to Cloudflare Pages
npx wrangler pages deploy dist
```

### Testing
```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Code Quality Standards

### TypeScript
- Strict mode enabled
- No `any` types - use proper typing
- Prefer interfaces over types for object shapes
- Use branded types for domain identifiers (UserId, BookId, etc.)

### Error Handling
- Use Result pattern for operations that can fail
- Domain errors for business rule violations
- Proper error boundaries in UI components
- Structured error responses from API

### Multi-tenancy
- All database queries MUST include tenant scoping
- Use middleware to enforce tenant isolation
- Never expose cross-tenant data
- Validate tenant access in all API procedures

### Performance
- Leverage Cloudflare edge locations
- Implement proper caching strategies
- Optimize bundle sizes (tree-shaking, code splitting)
- Use efficient database queries with proper indexes

## Security Guidelines

### Authentication
- Email-based passwordless authentication only
- Domain-based tenant association
- Secure session management with Lucia Auth
- Proper CORS configuration

### Authorization
- Role-based access control (Super Admin, Library Admin, Library Reader)
- Validate permissions at API level
- UI should reflect user permissions
- Principle of least privilege

### Data Protection
- Complete tenant data isolation
- Sanitize all user inputs
- Secure environment variable handling
- HTTPS everywhere