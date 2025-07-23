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

## Version Management with mise

This project uses [mise](https://mise.jdx.dev/) to manage tool versions consistently across development environments.

### Why mise?
- **Consistent versions**: Ensures all developers use the same Node.js, pnpm, and other tool versions
- **Automatic switching**: Automatically switches to project versions when entering the directory
- **Task runner**: Provides convenient task shortcuts for common operations
- **Cross-platform**: Works on macOS, Linux, and Windows

### Installation
```bash
# macOS
brew install mise

# Linux/WSL
curl https://mise.run | sh

# Windows (PowerShell)
irm https://mise.run | iex
```

### Usage
```bash
# Install all project tools (Node.js, pnpm, etc.)
mise install

# Run project tasks
mise run dev      # Start development servers
mise run build    # Build all packages
mise run test     # Run all tests
mise run lint     # Lint all code
mise run format   # Format all code

# Check tool versions
mise list
```

## Development Commands

### Setup & Installation
```bash
# Clone repository
git clone <repository-url>
cd OpenBookCorner

# Install mise (if not already installed)
# macOS: brew install mise
# Linux: curl https://mise.run | sh

# Install project tools and dependencies
mise install
mise run install

# Environment setup
cp .env.example .env
cp backend/.env.example backend/.env
```

### Database Operations
```bash
# Create D1 database
npx wrangler d1 create openbookcorner

# Run migrations
pnpm --filter backend run db:migrate

# Generate database types
pnpm --filter backend run db:generate
```

### Development Servers
```bash
# Start both frontend and backend (recommended)
mise run dev

# Or start individually:
# Frontend (port 5173)
pnpm run dev:frontend

# Backend (port 8787)
pnpm run dev:backend
```

### Build & Deploy
```bash
# Build all packages
mise run build

# Or use pnpm directly:
pnpm run build

# Deploy backend to Cloudflare Workers
pnpm run deploy:backend

# Deploy frontend to Cloudflare Pages
pnpm run deploy:frontend
```

### Testing
```bash
# Run all tests
mise run test

# Or use pnpm directly:
pnpm run test

# Run specific test suites:
pnpm run test:frontend
pnpm run test:backend
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