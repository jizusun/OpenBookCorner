---
inclusion: always
---

# Project Structure & Organization

> Finalized per `docs/adr/0001-tech-stack-and-hosting.md`: TanStack Start (React) frontend.

## Repository Structure

```
OpenBookCorner/
├── frontend/                     # TanStack Start (React) Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components (you own the source)
│   │   │   ├── barcode/        # Barcode scanning components
│   │   │   ├── books/          # Book-related components
│   │   │   └── auth/           # Authentication components
│   │   ├── routes/             # TanStack Router file-based routes
│   │   │   ├── __root.tsx      # Root route (global shell / PWA)
│   │   │   ├── _auth/          # Auth route group (login, verify)
│   │   │   └── _app/           # Authenticated app route group
│   │   ├── lib/
│   │   │   ├── trpc.ts         # tRPC + TanStack Query client setup
│   │   │   ├── query.ts        # QueryClient + offline persistence config
│   │   │   └── utils.ts        # Utility functions
│   │   ├── hooks/              # React hooks (e.g. useAuth)
│   │   ├── router.tsx          # Router instance
│   │   └── styles.css          # Tailwind entry
│   ├── public/                 # Static assets
│   ├── app.config.ts           # TanStack Start config
│   ├── vite.config.ts          # Vite configuration (incl. PWA plugin)
│   ├── tailwind.config.ts      # Tailwind CSS configuration
│   ├── components.json         # shadcn/ui registry configuration
│   └── tsconfig.json           # TypeScript configuration
├── backend/                      # Cloudflare Workers Backend
│   ├── src/
│   │   ├── router/             # tRPC routers by domain
│   │   ├── services/           # Domain services
│   │   ├── domain/             # Domain models and aggregates
│   │   ├── db/                 # Database layer (Drizzle)
│   │   ├── auth/               # Authentication logic (Lucia)
│   │   ├── middleware/         # Request middleware
│   │   ├── context.ts          # tRPC context creation
│   │   ├── trpc.ts             # tRPC server setup
│   │   └── index.ts            # Worker entry point (Hono app)
│   ├── wrangler.toml           # Cloudflare configuration
│   ├── package.json            # Backend dependencies
│   └── tsconfig.json           # Backend TypeScript configuration
├── shared/                       # Shared types and utilities
│   ├── types.ts                 # Shared TypeScript types
│   └── utils.ts                 # Shared utility functions
├── tests/                        # Test files
├── package.json                  # Root workspace configuration
├── AGENTS.md                     # AI agent instructions + tooling
└── .kiro/                        # Kiro AI configuration (agents, skills, steering, specs)
```

## Domain Organization

### Bounded Contexts
Organize code around three main domains:

1. **Library Management** - User auth, roles, library settings
2. **Catalog Management** - Book inventory, metadata, search
3. **Circulation** - Borrowing, returns, overdue tracking

### File Naming Conventions

**Frontend (TanStack Start / React):**
- Routes: file-based under `src/routes/` (e.g. `_app/books/index.tsx`, `_app/books/$bookId.tsx`)
- Route groups: underscore prefix (e.g. `_auth/`, `_app/`)
- Components: PascalCase `.tsx` (e.g. `BookCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g. `useAuth.ts`)
- Utils: camelCase (e.g. `formatDate.ts`)

**Backend (Workers):**
- Routers: camelCase domain names (e.g. `book.ts`)
- Services: PascalCase with Service suffix (e.g. `BookService.ts`)
- Domain models: PascalCase (e.g. `Library.ts`)
- Types: PascalCase interfaces (e.g. `BookMetadata`)

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

### React Component Structure
```tsx
// 1. Imports
import { Button } from "@/components/ui/button";

// 2. Props type
interface BookCardProps {
  book: Book;
  onBorrow: (bookId: string) => void;
}

// 3. Component
export function BookCard({ book, onBorrow }: BookCardProps) {
  // 3a. Hooks / derived state
  const isAvailable = book.availableQuantity > 0;

  // 3b. Handlers
  const handleBorrow = () => onBorrow(book.id);

  // 3c. Render
  return (
    <div className="component-wrapper">
      {/* Content */}
    </div>
  );
}
```

### Data Fetching Pattern (TanStack Query + tRPC)
```tsx
// Read: useQuery via tRPC + TanStack Query
const { data: books } = useQuery(trpc.book.list.queryOptions({ search }));

// Write with optimistic update
const borrow = useMutation(
  trpc.book.borrow.mutationOptions({
    onMutate: async (vars) => {
      // optimistic cache update
    },
    onSettled: () => queryClient.invalidateQueries(),
  }),
);
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
5. Build frontend routes/components (use shadcn MCP for UI, TanStack Intent skills for data/routing)
6. Add comprehensive tests
7. Update documentation

### Code Quality Standards
- Prefer interfaces over types for object shapes
- Use Result pattern for error handling
- Follow DDD principles for domain logic
- Implement proper error boundaries
- Use Tailwind CSS for styling
- Use shadcn/ui for UI components

### Testing Requirements
- **Unit**: Domain logic, utilities
- **Integration**: API procedures, database
- **E2E**: Complete user workflows
- **Component**: UI behavior (`@testing-library/react`)
- **Security**: Multi-tenant isolation
