---
inclusion: always
---

# Project Structure & Organization

## Repository Structure

```
OpenBookCorner/
├── frontend/                     # SvelteKit Frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── ui/          # shadcn-svelte components
│   │   │   │   ├── barcode/     # Barcode scanning components
│   │   │   │   ├── books/       # Book-related components
│   │   │   │   └── auth/        # Authentication components
│   │   │   ├── stores/          # Svelte stores for state management
│   │   │   ├── utils/           # Utility functions
│   │   │   └── trpc.ts          # tRPC client configuration
│   │   ├── routes/
│   │   │   ├── +layout.svelte   # Global layout with PWA shell
│   │   │   ├── +layout.ts       # Global data loading
│   │   │   ├── (auth)/          # Authentication routes
│   │   │   ├── (app)/           # Main application routes
│   │   │   └── api/trpc/[...trpc]/+server.ts # tRPC API handler
│   │   ├── app.html             # HTML template
│   │   └── service-worker.ts    # PWA service worker
│   ├── static/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   └── tsconfig.json            # TypeScript configuration
├── backend/                      # Cloudflare Workers Backend
│   ├── src/
│   │   ├── router/              # tRPC routers by domain
│   │   ├── services/            # Domain services
│   │   ├── domain/              # Domain models and aggregates
│   │   ├── db/                  # Database layer (Drizzle)
│   │   ├── auth/                # Authentication logic (Lucia)
│   │   ├── middleware/          # Request middleware
│   │   ├── context.ts           # tRPC context creation
│   │   ├── trpc.ts              # tRPC server setup
│   │   └── index.ts             # Worker entry point
│   ├── wrangler.toml            # Cloudflare configuration
│   ├── package.json             # Backend dependencies
│   └── tsconfig.json            # Backend TypeScript configuration
├── shared/                       # Shared types and utilities
│   ├── types.ts                 # Shared TypeScript types
│   └── utils.ts                 # Shared utility functions
├── tests/                        # Test files
├── package.json                  # Root workspace configuration
└── .kiro/                        # Kiro AI configuration
```

## Domain Organization

### Bounded Contexts
Organize code around three main domains:

1. **Library Management** - User auth, roles, library settings
2. **Catalog Management** - Book inventory, metadata, search
3. **Circulation** - Borrowing, returns, overdue tracking

### File Naming Conventions

**Frontend (SvelteKit):**
- Pages: `+page.svelte`, `+layout.svelte`
- Load functions: `+page.ts`, `+layout.ts`
- Components: PascalCase (e.g., `BookCard.svelte`)
- Stores: camelCase (e.g., `userStore.ts`)
- Utils: camelCase (e.g., `formatDate.ts`)

**Backend (Workers):**
- Routers: camelCase domain names (e.g., `book.ts`)
- Services: PascalCase with Service suffix (e.g., `BookService.ts`)
- Domain models: PascalCase (e.g., `Library.ts`)
- Types: PascalCase interfaces (e.g., `BookMetadata`)

## Critical Architecture Rules

### Multi-tenant Isolation (MANDATORY)
- **ALWAYS** scope database queries by `libraryId`
- **NEVER** allow cross-tenant data access
- Use middleware to enforce tenant boundaries
- Validate tenant access in all API procedures
- Include `libraryId` in all domain models

### Type Safety Requirements
- Use branded types for domain IDs (`UserId`, `BookId`, `LibraryId`)
- Share types between frontend/backend via tRPC
- Validate inputs with Zod schemas
- Enable strict TypeScript mode
- No `any` types allowed

### Svelte Component Structure
```svelte
<script lang="ts">
  // 1. Imports
  import { ... } from '...';
  
  // 2. Props (exported)
  export let prop: Type;
  
  // 3. Local state
  let localVar: Type;
  
  // 4. Reactive statements
  $: derivedValue = computeValue(prop);
  
  // 5. Functions
  function handleAction() {
    // Implementation
  }
</script>

<!-- Template -->
<div class="component-wrapper">
  <!-- Content -->
</div>
```

### tRPC Router Pattern
```typescript
export const domainRouter = router({
  // Queries (read operations)
  list: protectedProcedure
    .input(listSchema)
    .query(async ({ input, ctx }) => {
      // MUST validate tenant access first
      if (!ctx.libraryId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      // Implementation
    }),
  
  // Mutations (write operations)
  create: adminProcedure
    .input(createSchema)
    .mutation(async ({ input, ctx }) => {
      // MUST validate permissions and tenant
      if (!ctx.libraryId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      // Implementation
    }),
});
```

### Database Service Pattern
```typescript
export class DomainService {
  constructor(private db: D1Database) {}

  async findByLibrary(libraryId: string, filters: Filters) {
    // ALWAYS include libraryId in queries
    return await this.db
      .select()
      .from(table)
      .where(and(eq(table.libraryId, libraryId), ...filters));
  }
}
```

## Development Workflow

### Feature Implementation Order
1. Design domain model and types
2. Create/update database schema with tenant isolation
3. Implement backend service with tenant validation
4. Create tRPC router with proper procedures
5. Build frontend components
6. Add comprehensive tests
7. Update documentation

### Code Quality Standards
- Prefer interfaces over types for object shapes
- Use Result pattern for error handling
- Follow DDD principles for domain logic
- Implement proper error boundaries
- Use Tailwind CSS for styling
- Use shadcn-svelte for UI components

### Testing Requirements
- **Unit**: Domain logic, utilities
- **Integration**: API procedures, database
- **E2E**: Complete user workflows
- **Component**: UI behavior
- **Security**: Multi-tenant isolation