---
inclusion: always
---

# Project Structure & Organization

> Finalized per `docs/adr/0001-tech-stack-and-hosting.md`: TanStack Start (React) frontend.

## Repository Structure

```
OpenBookCorner/                   # Single TanStack Start (React) app on Cloudflare Workers
├── src/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components (you own the source)
│   │   ├── barcode/            # Barcode scanning components
│   │   ├── books/              # Book-related components
│   │   └── auth/               # Authentication components
│   ├── routes/                 # TanStack Router file-based routes
│   │   ├── __root.tsx          # Root route (global shell / PWA)
│   │   ├── _auth/              # Auth route group (login, verify)
│   │   └── _app/               # Authenticated app route group
│   ├── server/                 # Server-only code (runs on the Worker)
│   │   ├── functions/          # TanStack Start server functions by domain (book.ts, borrowing.ts…)
│   │   ├── services/           # Domain services (plain TS, called from server functions)
│   │   ├── domain/             # Domain models and aggregates
│   │   ├── db/                 # Database layer (Drizzle schema + client)
│   │   ├── auth/               # Authentication logic (Lucia)
│   │   └── middleware/         # Server-function middleware (auth + tenant guards)
│   ├── lib/
│   │   ├── query.ts            # QueryClient + offline persistence config
│   │   └── utils.ts            # Utility functions
│   ├── hooks/                  # React hooks (e.g. useAuth)
│   ├── router.tsx              # Router instance
│   └── styles.css              # Tailwind entry
├── public/                     # Static assets
├── tests/                      # Test files
├── app.config.ts               # TanStack Start config
├── vite.config.ts              # Vite configuration (incl. PWA plugin)
├── tailwind.config.ts          # Tailwind CSS configuration
├── components.json             # shadcn/ui registry configuration
├── drizzle.config.ts           # Drizzle migration config
├── wrangler.toml               # Cloudflare Workers configuration (D1/KV/R2 bindings)
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies + scripts
├── AGENTS.md                   # AI agent instructions + tooling
└── .kiro/                      # Kiro AI configuration (agents, skills, steering, specs)
```

> Phase 1 is a **single deployable** (TanStack Start on Workers): the React UI and the server
> functions ship together. If Phase 2 requires splitting the API out for China hosting, the
> `src/server/*` layer can be lifted into a standalone service (e.g. Hono) with minimal change,
> since services/domain/db are already framework-agnostic.

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

**Server (Workers):**
- Server functions: camelCase domain files (e.g. `server/functions/book.ts`)
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
- Share types between client and server via TanStack Start server functions (inferred end to end)
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

### Data Fetching Pattern (TanStack Query + server functions)
```tsx
// Define a server function (runs on the Worker, type-safe end to end)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const listBooks = createServerFn({ method: 'GET' })
  .validator(z.object({ search: z.string().optional() }))
  .handler(async ({ data, context }) => {
    // context carries the authenticated user + libraryId (set by middleware)
    const svc = new BookService(context.db);
    return svc.findByLibrary(context.libraryId, { search: data.search });
  });

// Consume it via TanStack Query on the client
const { data: books } = useQuery({
  queryKey: ['books', search],
  queryFn: () => listBooks({ data: { search } }),
});

// Write with optimistic update
const borrow = useMutation({
  mutationFn: (bookId: string) => borrowBook({ data: { bookId } }),
  onMutate: async (bookId) => {
    // optimistic cache update
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
});
```

### Server Function Pattern (auth + tenant guard first)
```typescript
import { createServerFn } from '@tanstack/react-start';

// Reusable guard: validates session + tenant, returns enriched context
const authed = createServerFn().middleware([authMiddleware, tenantMiddleware]);

export const addBook = authed
  .validator(createBookSchema)
  .handler(async ({ data, context }) => {
    // MUST have a tenant + admin role (enforced in middleware)
    if (!context.libraryId) throw new Error('UNAUTHORIZED');
    const svc = new BookService(context.db);
    return svc.create({ ...data, libraryId: context.libraryId });
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
4. Implement server functions (auth + tenant guard, then call service)
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
