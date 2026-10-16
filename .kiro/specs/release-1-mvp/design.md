# Design Document - Release 1: The Minimum Viable Product (MVP)

## Overview

Release 1 MVP establishes the foundational architecture and core circulation workflow for OpenBookCorner. This release validates the essential book borrowing and returning loop through a minimal but complete multi-tenant application deployed to a single early-adopter tenant.

The design prioritizes architectural correctness over feature richness, ensuring that the multi-tenant foundation, authentication system, and core domain models are properly established for future releases. The MVP focuses on proving the core value proposition: digitizing the book borrowing workflow without physical scanning requirements.

### Key Design Principles

- **Multi-tenancy First**: Complete data isolation architecture from day one
- **Minimal Viable Features**: Essential functionality only, no advanced features
- **Manual Operations**: Development team handles tenant and admin setup
- **Simple UI**: Functional interfaces without advanced UX patterns
- **No Physical Integration**: Pure digital workflow, no barcode scanning
- **Cloudflare Edge**: Serverless architecture optimized for performance and cost

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Frontend - TanStack Start (React) PWA"
        UI[User Interface]
        Auth[Auth Components]
        Catalog[Book Catalog]
        Borrowing[Borrowing Interface]
    end
    
    subgraph "TanStack Start Server (Cloudflare Workers)"
        API[Server Functions]
        AuthService[Auth Service]
        LibraryService[Library Service]
        BookService[Book Service]
        CirculationService[Circulation Service]
    end
    
    subgraph "Data Layer"
        D1[(D1 Database)]
        KV[KV Store - Sessions]
    end
    
    UI --> API
    Auth --> AuthService
    Catalog --> BookService
    Borrowing --> CirculationService
    
    AuthService --> KV
    LibraryService --> D1
    BookService --> D1
    CirculationService --> D1
```

### Domain-Driven Design Structure

The MVP implements a simplified version of the full DDD architecture, focusing on three core bounded contexts:

#### 1. Library Management Context
**Responsibility**: Multi-tenant foundation, user authentication, and basic access control

**Key Components:**
- Library aggregate (tenant management)
- User aggregate (authentication and roles)
- Email-based passwordless authentication
- Manual tenant and admin setup

#### 2. Catalog Management Context  
**Responsibility**: Book inventory and simple catalog display

**Key Components:**
- Book aggregate (title, author, ISBN, availability)
- Manual book entry workflow
- Simple list-based catalog view
- No search or pagination in MVP

#### 3. Circulation Context
**Responsibility**: Core borrowing and returning workflow

**Key Components:**
- Borrow transaction aggregate
- Digital-only borrowing (no scanning)
- Due date management (14-day default)
- Simple "My Books" interface

## Components and Interfaces

### 1. Authentication System

**Design Decision**: Email-based passwordless authentication with verification codes
**Rationale**: Eliminates password management complexity while providing secure access through corporate email verification

```typescript
// Authentication Flow
interface AuthenticationService {
  sendVerificationCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<AuthResult>;
  validateSession(sessionId: string): Promise<User | null>;
}

interface AuthResult {
  success: boolean;
  user?: User;
  sessionToken?: string;
  error?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  libraryId: string;
  role: 'library_admin' | 'library_reader';
  isActive: boolean;
}
```

**Implementation Approach:**
- Lucia Auth for session management
- Cloudflare KV for verification code storage (5-minute TTL)
- Corporate email domain validation for tenant association
- Manual user creation by development team for MVP

### 2. Multi-Tenant Library Management

**Design Decision**: Application-level tenant isolation with library-scoped data access
**Rationale**: Ensures complete data separation while maintaining simple database schema

```typescript
interface Library {
  id: string;
  name: string;
  emailDomains: string[];
  settings: LibrarySettings;
  isActive: boolean;
  createdAt: Date;
}

interface LibrarySettings {
  borrowingPeriodDays: number; // Default: 14
  maxBooksPerReader: number;   // Default: 5
  allowExtensions: boolean;    // Default: false
}

interface LibraryService {
  createLibrary(name: string, emailDomains: string[]): Promise<Library>;
  findByEmailDomain(email: string): Promise<Library | null>;
  validateUserAccess(userId: string, libraryId: string): Promise<boolean>;
}
```

**Tenant Isolation Strategy:**
- All database queries include `libraryId` filter
- Middleware enforces tenant context on all API calls
- User sessions include library scope
- Cross-tenant operations explicitly forbidden

### 3. Book Catalog Management

**Design Decision**: Simple manual book entry with minimal metadata
**Rationale**: Focuses on core functionality without external API dependencies or complex metadata management

```typescript
interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  libraryId: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface BookService {
  addBook(book: CreateBookRequest): Promise<Book>;
  getLibraryCatalog(libraryId: string): Promise<Book[]>;
  updateAvailability(bookId: string, isAvailable: boolean): Promise<void>;
}

interface CreateBookRequest {
  isbn: string;
  title: string;
  author: string;
  libraryId: string;
}
```

**Catalog Display Features:**
- Simple list view (no pagination in MVP)
- Display: title, author, availability status
- No search functionality in MVP
- Real-time availability updates
- Librarian-only book addition

### 4. Circulation Management

**Design Decision**: Digital-only borrowing workflow with automatic due dates
**Rationale**: Eliminates physical scanning complexity while providing complete borrowing tracking

```typescript
interface BorrowTransaction {
  id: string;
  bookId: string;
  userId: string;
  libraryId: string;
  borrowedAt: Date;
  dueDate: Date;
  returnedAt?: Date;
  isOverdue: boolean;
}

interface CirculationService {
  borrowBook(bookId: string, userId: string): Promise<BorrowTransaction>;
  returnBook(transactionId: string): Promise<void>;
  getUserBorrowedBooks(userId: string): Promise<BorrowedBook[]>;
  checkOverdueBooks(libraryId: string): Promise<BorrowTransaction[]>;
}

interface BorrowedBook {
  transactionId: string;
  book: Book;
  borrowedAt: Date;
  dueDate: Date;
  isOverdue: boolean;
}
```

**Borrowing Workflow:**
1. User selects available book from catalog
2. System creates borrow transaction
3. Book marked as unavailable
4. Due date set to 14 days from borrow date
5. Transaction appears in user's "My Books"

**Returning Workflow:**
1. User selects book from "My Books"
2. System updates transaction with return date
3. Book marked as available in catalog
4. Transaction moved to history

### 5. User Interface Components

**Design Decision**: Minimal, functional UI with shadcn/ui components
**Rationale**: Focus on core functionality over visual polish, using proven component library for consistency

#### Authentication UI
```tsx
// Login Component (src/components/auth/LoginCard.tsx)
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendCode, verifyCode } from "@/server/functions/auth";

export function LoginCard() {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");

  const sendCodeMutation = useMutation({
    mutationFn: () => sendCode({ data: { email } }),
    onSuccess: () => setStep("verify"),
  });

  const verifyCodeMutation = useMutation({
    mutationFn: () => verifyCode({ data: { email, code: verificationCode } }),
  });

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Library Access</CardTitle>
      </CardHeader>
      <CardContent>
        {step === "email" ? (
          <div className="space-y-4">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email"
              type="email"
            />
            <Button onClick={() => sendCodeMutation.mutate()} className="w-full">
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
            />
            <Button onClick={() => verifyCodeMutation.mutate()} className="w-full">
              Verify & Login
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Book Catalog UI
```tsx
// Catalog Component (src/components/books/BookCatalog.tsx)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { borrowBook } from "@/server/functions/book";
import type { Book } from "@/server/domain/types";

interface BookCatalogProps {
  books: Book[];
  userRole: string;
}

export function BookCatalog({ books, userRole }: BookCatalogProps) {
  const queryClient = useQueryClient();
  const borrow = useMutation({
    mutationFn: (bookId: string) => borrowBook({ data: { bookId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Library Catalog</h1>
        {userRole === "library_admin" && (
          <Button asChild>
            <a href="/admin/books/add">Add Book</a>
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {books.map((book) => (
          <Card key={book.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{book.title}</h3>
                  <p className="text-sm text-muted-foreground">by {book.author}</p>
                  <p className="text-xs text-muted-foreground">ISBN: {book.isbn}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={book.isAvailable ? "default" : "secondary"}>
                    {book.isAvailable ? "Available" : "Borrowed"}
                  </Badge>
                  {book.isAvailable && userRole === "library_reader" && (
                    <Button size="sm" onClick={() => borrow.mutate(book.id)}>
                      Borrow
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### My Books UI
```tsx
// My Books Component (src/components/books/MyBooks.tsx)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { returnBook } from "@/server/functions/borrowing";
import type { BorrowedBook } from "@/server/domain/types";

interface MyBooksProps {
  borrowedBooks: BorrowedBook[];
}

export function MyBooks({ borrowedBooks }: MyBooksProps) {
  const queryClient = useQueryClient();
  const returnMutation = useMutation({
    mutationFn: (transactionId: string) => returnBook({ data: { transactionId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["my-books"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Books</h1>

      {borrowedBooks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No books currently borrowed</p>
            <Button asChild className="mt-4">
              <a href="/catalog">Browse Catalog</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {borrowedBooks.map((item) => (
            <Card key={item.transactionId}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{item.book.title}</h3>
                    <p className="text-sm text-muted-foreground">by {item.book.author}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {item.dueDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={item.isOverdue ? "destructive" : "default"}>
                      {item.isOverdue ? "Overdue" : "Borrowed"}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => returnMutation.mutate(item.transactionId)}
                    >
                      Return
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Data Models

### Database Schema (Cloudflare D1)

**Design Decision**: Minimal schema focused on MVP requirements with multi-tenant isolation
**Rationale**: Simple structure that can evolve, with tenant isolation built into every table

```sql
-- Libraries (Tenants)
CREATE TABLE libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email_domains TEXT NOT NULL, -- JSON array
  settings TEXT NOT NULL,      -- JSON object
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  library_id TEXT NOT NULL REFERENCES libraries(id),
  role TEXT NOT NULL CHECK (role IN ('library_admin', 'library_reader')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT,
  UNIQUE(email, library_id)
);

-- Sessions (for Lucia Auth)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

-- Books
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  isbn TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  library_id TEXT NOT NULL REFERENCES libraries(id),
  is_available INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Borrow Transactions
CREATE TABLE borrow_transactions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  library_id TEXT NOT NULL REFERENCES libraries(id),
  borrowed_at TEXT NOT NULL,
  due_date TEXT NOT NULL,
  returned_at TEXT,
  is_overdue INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_users_library_id ON users(library_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_books_library_id ON books(library_id);
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_transactions_user_id ON borrow_transactions(user_id);
CREATE INDEX idx_transactions_book_id ON borrow_transactions(book_id);
CREATE INDEX idx_transactions_library_id ON borrow_transactions(library_id);
```

### Server Function API Schema

Server logic uses **TanStack Start server functions** (`createServerFn`) grouped by domain under
`src/server/functions/`. A reusable auth + tenant guard middleware validates the session and tenant,
then puts `{ user, libraryId, db }` on `context`. Every data access is scoped by `libraryId`.

```typescript
// src/server/functions/_guards.ts
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, tenantMiddleware } from "@/server/middleware/auth";

// Any authenticated member (context has { user, libraryId, db })
export const authed = createServerFn().middleware([authMiddleware, tenantMiddleware]);

// Admin-only guard (adds a role check on top of authed)
export const adminOnly = createServerFn().middleware([
  authMiddleware,
  tenantMiddleware,
  adminMiddleware,
]);
```

```typescript
// src/server/functions/auth.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendCode = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data, context }) => {
    // Generate and store verification code in KV (5-min TTL)
    // Send email (mock in MVP)
  });

export const verifyCode = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email(), code: z.string().length(6) }))
  .handler(async ({ data, context }) => {
    // Verify code, create Lucia session
  });

export const me = authed.handler(async ({ context }) => {
  // context.user is set by the auth guard
  return context.user;
});
```

```typescript
// src/server/functions/book.ts
import { z } from "zod";
import { authed, adminOnly } from "./_guards";
import { BookService } from "@/server/services/BookService";

export const listBooks = authed.handler(async ({ context }) => {
  const svc = new BookService(context.db);
  // ALWAYS scoped by the authenticated tenant
  return svc.findByLibrary(context.libraryId);
});

export const addBook = adminOnly
  .validator(z.object({ isbn: z.string(), title: z.string(), author: z.string() }))
  .handler(async ({ data, context }) => {
    const svc = new BookService(context.db);
    return svc.create({ ...data, libraryId: context.libraryId });
  });

export const borrowBook = authed
  .validator(z.object({ bookId: z.string() }))
  .handler(async ({ data, context }) => {
    const svc = new BookService(context.db);
    return svc.borrowBook(data.bookId, context.user.id, context.libraryId);
  });
```

```typescript
// src/server/functions/borrowing.ts
import { z } from "zod";
import { authed } from "./_guards";
import { CirculationService } from "@/server/services/CirculationService";

export const myBooks = authed.handler(async ({ context }) => {
  const svc = new CirculationService(context.db);
  return svc.getUserBorrowedBooks(context.user.id, context.libraryId);
});

export const returnBook = authed
  .validator(z.object({ transactionId: z.string() }))
  .handler(async ({ data, context }) => {
    const svc = new CirculationService(context.db);
    return svc.returnBook(data.transactionId, context.libraryId);
  });
```

## Error Handling

### Error Categories and Responses

**Design Decision**: Structured error handling with user-friendly messages
**Rationale**: Clear error communication improves user experience and debugging

```typescript
// Error Types
export enum ErrorCode {
  // Authentication
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  EMAIL_DOMAIN_NOT_ALLOWED = 'EMAIL_DOMAIN_NOT_ALLOWED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Authorization
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  LIBRARY_ACCESS_DENIED = 'LIBRARY_ACCESS_DENIED',
  
  // Business Logic
  BOOK_NOT_AVAILABLE = 'BOOK_NOT_AVAILABLE',
  BOOK_ALREADY_BORROWED = 'BOOK_ALREADY_BORROWED',
  INVALID_RETURN_REQUEST = 'INVALID_RETURN_REQUEST',
  DUPLICATE_ISBN = 'DUPLICATE_ISBN',
}

// Error Response Format
interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
}

// Error Handling Examples
class CirculationService {
  async borrowBook(bookId: string, userId: string): Promise<BorrowTransaction> {
    const book = await this.bookRepository.findById(bookId);
    
    if (!book) {
      throw new DomainError('Book not found', ErrorCode.BOOK_NOT_AVAILABLE);
    }
    
    if (!book.isAvailable) {
      throw new DomainError(
        'Book is not available for borrowing',
        ErrorCode.BOOK_NOT_AVAILABLE
      );
    }
    
    // Process borrowing...
  }
}
```

> Server functions surface `DomainError` to the client with its `code`; TanStack Query exposes it in
> the mutation/query `error` state for the UI to map to a friendly message.

### Frontend Error Handling

```tsx
// Error Display Component (src/components/ErrorAlert.tsx)
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ErrorAlertProps {
  error: string | null;
}

function getErrorMessage(error: string): string {
  switch (error) {
    case "BOOK_NOT_AVAILABLE":
      return "This book is currently borrowed by another member.";
    case "INVALID_VERIFICATION_CODE":
      return "The verification code is invalid or has expired.";
    case "INSUFFICIENT_PERMISSIONS":
      return "You do not have permission to perform this action.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}
```

## Testing Strategy

### Unit Testing Approach

**Design Decision**: Focus on business logic and critical paths
**Rationale**: MVP requires reliable core functionality with efficient testing coverage

```typescript
// Service Layer Tests
describe('CirculationService', () => {
  let service: CirculationService;
  let mockBookRepo: jest.Mocked<BookRepository>;
  let mockTransactionRepo: jest.Mocked<TransactionRepository>;
  
  beforeEach(() => {
    mockBookRepo = createMockBookRepository();
    mockTransactionRepo = createMockTransactionRepository();
    service = new CirculationService(mockBookRepo, mockTransactionRepo);
  });
  
  describe('borrowBook', () => {
    it('should create borrow transaction for available book', async () => {
      // Arrange
      const book = createMockBook({ isAvailable: true });
      mockBookRepo.findById.mockResolvedValue(book);
      
      // Act
      const result = await service.borrowBook(book.id, 'user-123');
      
      // Assert
      expect(result.bookId).toBe(book.id);
      expect(result.userId).toBe('user-123');
      expect(mockBookRepo.updateAvailability).toHaveBeenCalledWith(book.id, false);
    });
    
    it('should throw error when book is not available', async () => {
      // Arrange
      const book = createMockBook({ isAvailable: false });
      mockBookRepo.findById.mockResolvedValue(book);
      
      // Act & Assert
      await expect(service.borrowBook(book.id, 'user-123'))
        .rejects.toThrow('Book is not available');
    });
  });
});
```

### Integration Testing

```typescript
// Server Function Integration Tests
// Server functions are tested by invoking their handler with a mocked context
// (the auth/tenant guard is mocked to supply user + libraryId + db).
describe('Book server functions', () => {
  let testDb: D1Database;
  let testLibrary: Library;
  let testUser: User;
  
  beforeEach(async () => {
    testDb = await createTestDatabase();
    testLibrary = await createTestLibrary(testDb);
    testUser = await createTestUser(testDb, testLibrary.id);
  });
  
  describe('addBook', () => {
    it('should add book to library catalog', async () => {
      const context = {
        db: testDb,
        user: testUser,
        libraryId: testLibrary.id,
      };

      const result = await addBook({
        data: {
          isbn: '978-0132350884',
          title: 'Clean Code',
          author: 'Robert Martin',
        },
        context,
      });

      expect(result.title).toBe('Clean Code');
      
      // Verify in database (scoped by tenant)
      const books = await testDb.prepare(
        'SELECT * FROM books WHERE library_id = ?'
      ).bind(testLibrary.id).all();
      
      expect(books.results).toHaveLength(1);
    });
  });
});
```

### End-to-End Testing

```typescript
// E2E Workflow Tests
describe('Borrowing Workflow', () => {
  test('complete borrow and return flow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'reader@testcorp.com');
    await page.click('[data-testid=send-code]');
    await page.fill('[data-testid=code-input]', '123456');
    await page.click('[data-testid=verify-code]');
    
    // Browse catalog
    await page.goto('/catalog');
    await expect(page.locator('[data-testid=book-list]')).toBeVisible();
    
    // Borrow book
    await page.click('[data-testid=book-card]:first-child [data-testid=borrow-btn]');
    await expect(page.locator('[data-testid=success-message]')).toContainText('borrowed');
    
    // Check My Books
    await page.goto('/my-books');
    await expect(page.locator('[data-testid=borrowed-book]')).toBeVisible();
    
    // Return book
    await page.click('[data-testid=return-btn]');
    await expect(page.locator('[data-testid=success-message]')).toContainText('returned');
    
    // Verify availability in catalog
    await page.goto('/catalog');
    await expect(page.locator('[data-testid=book-card]:first-child [data-testid=availability]'))
      .toContainText('Available');
  });
});
```

## Deployment and Operations

### Manual Setup Process

**Design Decision**: Development team handles initial setup for MVP
**Rationale**: Reduces complexity and allows focus on core functionality validation

#### Tenant Setup Process
1. **Database Initialization**
   ```sql
   INSERT INTO libraries (id, name, email_domains, settings) VALUES (
     'lib-techcorp-001',
     'TechCorp Library',
     '["@techcorp.com"]',
     '{"borrowingPeriodDays": 14, "maxBooksPerReader": 5, "allowExtensions": false}'
   );
   ```

2. **Admin User Creation**
   ```sql
   INSERT INTO users (id, email, name, library_id, role) VALUES (
     'user-admin-001',
     'librarian@techcorp.com',
     'Library Administrator',
     'lib-techcorp-001',
     'library_admin'
   );
   ```

3. **Environment Configuration**
   ```bash
   # Cloudflare Workers environment
   wrangler secret put JWT_SECRET
   wrangler secret put EMAIL_API_KEY
   
   # D1 Database binding
   wrangler d1 create openbookcorner-mvp
   ```

### Monitoring and Observability

```typescript
// Basic logging for MVP
interface LogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context: {
    userId?: string;
    libraryId?: string;
    action?: string;
    metadata?: Record<string, any>;
  };
}

// Key metrics to track
const MetricsToTrack = {
  USER_LOGINS: 'user_logins',
  BOOKS_BORROWED: 'books_borrowed',
  BOOKS_RETURNED: 'books_returned',
  BOOKS_ADDED: 'books_added',
  API_ERRORS: 'api_errors',
};
```

This design document establishes a solid foundation for the MVP while maintaining architectural principles that will support future releases. The focus on simplicity and manual operations allows for rapid validation of the core value proposition while building the multi-tenant infrastructure needed for scale.