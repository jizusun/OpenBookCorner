# Technology Stack & Development Guidelines

## Core Technology Stack

### Frontend
- **Framework**: SvelteKit ^2.8.0 with TypeScript ^5.7.0
- **Styling**: Tailwind CSS ^3.4.0 for utility-first styling
- **UI Components**: shadcn-svelte ^0.13.0 (copy-paste, tree-shakeable components)
- **API Client**: tRPC-SvelteKit ^0.3.0 for type-safe API calls
- **PWA**: @vite-pwa/sveltekit ^0.6.0 with Service Worker
- **Camera**: Camera API for barcode scanning functionality
- **Build Tool**: Vite ^5.4.0

### Backend
- **Runtime**: Cloudflare Workers (Workerd runtime)
- **Framework**: Hono.js ^4.6.0 for edge-optimized HTTP handling
- **API**: tRPC ^10.45.0 with @hono/trpc-server ^0.3.0 integration
- **Authentication**: Lucia Auth ^3.2.0 for session management
- **ORM**: Drizzle ORM ^0.36.0 for type-safe database operations
- **Language**: TypeScript ^5.7.0 throughout
- **Deployment**: Wrangler ^3.84.0

### Database & Storage
- **Primary Database**: Cloudflare D1 (SQLite 3.45.0-based)
- **Database Adapter**: @lucia-auth/adapter-sqlite ^3.0.0
- **Caching**: Cloudflare KV for sessions and temporary data
- **File Storage**: Cloudflare R2 for book cover images
- **External APIs**: Open Library API for book metadata
- **Schema Validation**: Zod ^3.23.0

### Architecture Patterns
- **Domain-Driven Design**: Organized around bounded contexts (Library Management, Catalog Management, Circulation)
- **Multi-tenant**: Complete data isolation at application level
- **Event-Driven**: Domain events for cross-aggregate communication
- **CQRS**: Separate read/write models where beneficial

## Version Management with mise

This project uses [mise](https://mise.jdx.dev/) v2024.12.0 to manage tool versions consistently across development environments.

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

# Or install specific version
curl https://mise.run | MISE_VERSION=v2024.12.0 sh
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

## Version Requirements

### Node.js & Package Manager
- **Node.js**: ^20.11.0 (LTS)
- **pnpm**: ^9.12.0 (workspace support)
- **npm**: Not used (pnpm only)

### Key Dependencies Versions

**Frontend Dependencies:**
```json
{
  "@sveltejs/kit": "^2.8.0",
  "@sveltejs/vite-plugin-svelte": "^4.0.0",
  "svelte": "^5.0.0",
  "typescript": "^5.7.0",
  "vite": "^5.4.0",
  "tailwindcss": "^3.4.0",
  "@tailwindcss/typography": "^0.5.15",
  "autoprefixer": "^10.4.20",
  "postcss": "^8.4.49",
  "@vite-pwa/sveltekit": "^0.6.0",
  "trpc-sveltekit": "^0.3.0",
  "@trpc/client": "^10.45.0",
  "zod": "^3.23.0"
}
```

**Backend Dependencies:**
```json
{
  "hono": "^4.6.0",
  "@hono/trpc-server": "^0.3.0",
  "@trpc/server": "^10.45.0",
  "lucia": "^3.2.0",
  "@lucia-auth/adapter-sqlite": "^3.0.0",
  "drizzle-orm": "^0.36.0",
  "drizzle-kit": "^0.28.0",
  "wrangler": "^3.84.0",
  "typescript": "^5.7.0",
  "zod": "^3.23.0"
}
```

**Development Dependencies:**
```json
{
  "vitest": "^2.1.0",
  "@playwright/test": "^1.48.0",
  "eslint": "^9.15.0",
  "@typescript-eslint/eslint-plugin": "^8.15.0",
  "@typescript-eslint/parser": "^8.15.0",
  "prettier": "^3.3.0",
  "prettier-plugin-svelte": "^3.2.0",
  "prettier-plugin-tailwindcss": "^0.6.0"
}
```

### Runtime Versions
- **Cloudflare Workers**: Workerd runtime (V8 engine)
- **SQLite**: 3.45.0 (via Cloudflare D1)
- **WebAssembly**: Supported for performance-critical operations

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