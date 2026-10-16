# Technology Stack & Development Guidelines

> Finalized per `docs/adr/0001-tech-stack-and-hosting.md`. Phase 1 targets Cloudflare with
> email/password auth. WeChat/China integration is Phase 2 (see ADR 0001).

## Core Technology Stack

### Frontend
- **Framework**: TanStack Start (React, full-stack, Vite) with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **UI Components**: shadcn/ui (copy-paste, tree-shakeable, you own the component source)
- **Client Data / State**: TanStack Query (caching, optimistic UI, offline persistence)
- **Routing**: TanStack Router (type-safe routes, typed search params)
- **Server calls**: TanStack Start **server functions** (`createServerFn`), consumed through
  TanStack Query for caching/optimistic UI (no tRPC)
- **PWA**: Vite PWA plugin (Service Worker, Web App Manifest)
- **Camera**: Camera API for barcode scanning (Phase 1 web). In WeChat WebView (Phase 2),
  ISBN scanning uses the WeChat JS-SDK `wx.scanCode`.

### Backend / Server
- **Runtime**: Cloudflare Workers (TanStack Start deploys here)
- **Server logic**: TanStack Start **server functions** (`createServerFn`) — type-safe client↔server
  calls with no separate RPC layer. (No tRPC, no Hono in Phase 1.)
- **Service layer**: plain TypeScript domain services called from server functions
- **Authentication**: Lucia Auth. **Phase 1: email/password.** (Phase 2 adds WeChat OAuth.)
- **ORM**: Drizzle ORM for type-safe database operations
- **Language**: TypeScript throughout

> A standalone API (Hono + tRPC, or Hono RPC) may be reintroduced in **Phase 2** only if the backend
> must be split from the frontend for China hosting. It is intentionally omitted in Phase 1.

### Database & Storage
- **Primary Database**: Cloudflare D1 (SQLite-based). Drizzle keeps this portable to Postgres
  for the Phase 2 China migration.
- **Caching / Sessions / Codes**: Cloudflare KV
- **File Storage**: Cloudflare R2 for book cover images
- **External APIs**: Open Library API for book metadata

### Architecture Patterns
- **Domain-Driven Design**: Organized around bounded contexts (Library Management, Catalog Management, Circulation)
- **Multi-tenant**: Complete data isolation at application level
- **Event-Driven**: Domain events for cross-aggregate communication
- **CQRS**: Separate read/write models where beneficial

## AI / Agent Tooling

This project is set up for AI-assisted development. See `AGENTS.md` and `.kiro/agents/openbookcorner.json`.

- **TanStack Intent**: versioned Agent Skills shipped inside TanStack npm packages. Run
  `npx @tanstack/intent@latest install` once the project is scaffolded, then `load` skills on demand
  (e.g. `@tanstack/query#fetching`) so agents use version-matched APIs.
- **shadcn MCP** (`npx shadcn@latest mcp`): browse/search/install UI components via natural language.
- **Cloudflare MCP** (`https://mcp.cloudflare.com/mcp`): Cloudflare docs + Workers/D1/KV/R2 ops + deploy.
- **llms.txt**: Drizzle (via its `llms.txt`). (Hono `https://hono.dev/llms-full.txt` only if a
  standalone Hono API is added in Phase 2.)

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

# One-time: install TanStack Intent agent-skill guidance
npx @tanstack/intent@latest install
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
# Frontend (TanStack Start dev server)
pnpm run dev:frontend

# Backend (Cloudflare Worker, port 8787)
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

# Deploy frontend to Cloudflare (Workers/Pages)
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
- Implement proper caching strategies (TanStack Query on the client)
- Optimize bundle sizes (tree-shaking, code splitting)
- Use efficient database queries with proper indexes

## Security Guidelines

### Authentication
- Phase 1: email/password authentication via Lucia Auth
- Secure session management with Lucia Auth
- Proper CORS configuration
- Phase 2: WeChat OAuth with `openid`/`unionid` account binding (requires ICP filing +
  WeChat Official Account — see ADR 0001)

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
