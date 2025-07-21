# Testing Strategy & Guidelines

## Two-Level Testing Approach

OpenBookCorner follows a comprehensive **BDD + TDD** testing strategy that ensures both business requirements and technical implementation are thoroughly validated.

### BDD (Behavior-Driven Development) - Feature Level
- **Given-When-Then** scenarios for business requirements
- **Living documentation** that stakeholders can understand
- **Feature files** describing user behavior and business rules
- **Acceptance criteria** validation through executable specifications

### TDD (Test-Driven Development) - Implementation Level  
- **Red-Green-Refactor** cycle for all code implementation
- **Unit tests** for functions, methods, and classes
- **Integration tests** for API endpoints and database operations
- **Component tests** for UI interactions

## Development Flow for Each Feature

Every feature implementation must follow this strict sequence:

1. **BDD**: Write feature scenarios in Gherkin (Given-When-Then)
2. **BDD**: Create step definitions that call implementation code
3. **TDD**: Write failing unit tests for implementation details
4. **TDD**: Write minimal code to pass unit tests
5. **TDD**: Refactor while keeping tests green
6. **BDD**: Verify feature scenarios pass (living documentation)

## Testing Tools & Framework

### Core Testing Stack
- **Vitest**: Unit and integration testing framework
- **Playwright**: End-to-end testing and browser automation
- **Cucumber**: BDD framework for Gherkin scenarios
- **@testing-library/svelte**: Component testing utilities
- **MSW (Mock Service Worker)**: API mocking for tests

### Test Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  }
});
```

## BDD Feature Scenarios

### Multi-Tenant Data Isolation
```gherkin
Feature: Multi-tenant data isolation
  As a library system
  I want to ensure complete data isolation between tenants
  So that libraries cannot access each other's data

  Scenario: Library data is isolated by tenant
    Given a library "Tech Corp Library" exists
    And a library "Design Agency Library" exists
    When I query books as "Tech Corp Library" user
    Then I should only see "Tech Corp Library" books
    And I should not see "Design Agency Library" books

  Scenario: Cross-tenant API access is blocked
    Given I am authenticated as "Tech Corp Library" admin
    When I try to access "Design Agency Library" books via API
    Then I should receive "Forbidden" error
```

### Authentication & Authorization
```gherkin
Feature: Email verification login
  As a library user
  I want to login with email verification
  So that I can access the library system securely

  Scenario: Successful login with verification code
    Given I am on the login page
    When I enter email "admin@techcorp.com"
    And I receive a verification code
    And I enter the correct verification code
    Then I should be logged in as "Tech Corp Library" admin
    And I should see the admin dashboard

  Scenario: Invalid verification code
    Given I am on the login page
    When I enter email "admin@techcorp.com"
    And I enter an invalid verification code
    Then I should see "Invalid verification code" error
    And I should remain on the login page
```

### Role-Based Access Control
```gherkin
Feature: Role-based permissions
  As a library system
  I want to enforce role-based access control
  So that users can only perform actions they're authorized for

  Scenario: Library admin can manage books
    Given I am logged in as "library_admin"
    When I try to add a new book
    Then I should be able to add the book
    And the book should appear in the catalog

  Scenario: Library reader cannot manage books
    Given I am logged in as "library_reader"
    When I try to add a new book
    Then I should see "Permission denied" error
    And no book should be added
```

### Book Management
```gherkin
Feature: Book inventory management
  As a library admin
  I want to manage book inventory
  So that I can track available copies

  Scenario: Add book with multiple copies
    Given I am a library admin
    When I add "Clean Code" with 3 copies
    Then the book should show 3 available copies
    And the book should appear in search results

  Scenario: ISBN validation and metadata lookup
    Given an ISBN "978-0132350884"
    When I lookup book metadata
    Then I should get "Clean Code" by "Robert Martin"
    And the metadata should include publisher information
```

### Borrowing Workflows
```gherkin
Feature: Book borrowing
  As a library reader
  I want to borrow books
  So that I can read them

  Scenario: Reader borrows available book
    Given a book "Clean Code" is available
    When reader "john@techcorp.com" borrows it
    Then the book should be marked as borrowed
    And due date should be set to 14 days from now
    And available copies should decrease by 1

  Scenario: Reader with overdue books cannot borrow
    Given reader has overdue books
    When they try to borrow another book
    Then they should see "Return overdue books first" error
    And the borrowing should be rejected
```

### Barcode Scanning
```gherkin
Feature: Barcode scanning
  As a library user
  I want to scan book barcodes
  So that I can quickly identify and manage books

  Scenario: Scan ISBN barcode
    Given I have camera permission
    When I scan ISBN barcode "978-0132350884"
    Then the system should detect the ISBN
    And show book information for "Clean Code"

  Scenario: Scan to borrow workflow
    Given I am a library reader
    When I scan a book barcode
    And select "borrow" action
    Then the book should be borrowed to me
    And I should see borrowing confirmation
```

### Offline PWA Features
```gherkin
Feature: Offline book browsing
  As a library user
  I want to browse books while offline
  So that I can use the app without internet connection

  Scenario: Browse books while offline
    Given I have browsed books while online
    When I go offline
    Then I should still see cached book list
    And I should be able to view book details

  Scenario: Offline borrowing sync
    Given I am offline
    When I borrow a book
    Then the action should be queued
    And sync when I come back online
    And the book should be marked as borrowed
```

## TDD Unit Testing Patterns

### Domain Value Objects
```typescript
// tests/domain/ISBN.test.ts
describe('ISBN Value Object', () => {
  it('should accept valid ISBN-13', () => {
    const isbn = ISBN.create('978-0132350884');
    expect(isbn.isValid()).toBe(true);
  });

  it('should reject invalid ISBN format', () => {
    expect(() => ISBN.create('invalid-isbn')).toThrow('Invalid ISBN format');
  });

  it('should normalize ISBN format', () => {
    const isbn = ISBN.create('978-0-13-235088-4');
    expect(isbn.toString()).toBe('9780132350884');
  });
});
```

### Domain Aggregates
```typescript
// tests/domain/Library.test.ts
describe('Library Aggregate', () => {
  it('should create library with valid email domains', () => {
    const library = Library.create('Tech Corp', ['@techcorp.com']);
    expect(library.getName().value).toBe('Tech Corp');
    expect(library.canUserJoin(Email.create('user@techcorp.com'))).toBe(true);
  });

  it('should reject user with non-matching email domain', () => {
    const library = Library.create('Tech Corp', ['@techcorp.com']);
    expect(library.canUserJoin(Email.create('user@other.com'))).toBe(false);
  });
});
```

### Repository Patterns
```typescript
// tests/repositories/BookRepository.test.ts
describe('Book Repository', () => {
  let repository: BookRepository;
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    repository = new DrizzleBookRepository(db);
  });

  it('should save book with tenant isolation', async () => {
    const book = Book.create('978-0132350884', metadata, libraryId);
    await repository.save(book);
    
    const saved = await repository.findById(book.getId());
    expect(saved?.getLibraryId()).toBe(libraryId);
  });

  it('should not find books from other tenants', async () => {
    const book = Book.create('978-0132350884', metadata, otherLibraryId);
    await repository.save(book);
    
    const found = await repository.findByISBN('978-0132350884', libraryId);
    expect(found).toBeNull();
  });
});
```

### tRPC Procedures
```typescript
// tests/api/book.test.ts
describe('Book tRPC Router', () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    caller = createCaller(createMockContext());
  });

  it('should list books for authenticated user', async () => {
    const books = await caller.book.list({ search: 'Clean' });
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Clean Code');
  });

  it('should reject unauthorized book creation', async () => {
    const context = createMockContext({ role: 'library_reader' });
    const caller = createCaller(context);
    
    await expect(caller.book.add({
      isbn: '978-0132350884',
      title: 'Clean Code',
      author: 'Robert Martin'
    })).rejects.toThrow('Insufficient permissions');
  });
});
```

## Component Testing

### Svelte Component Tests
```typescript
// tests/components/BookCard.test.ts
import { render, screen } from '@testing-library/svelte';
import { vi } from 'vitest';
import BookCard from '$lib/components/BookCard.svelte';

describe('BookCard Component', () => {
  const mockBook = {
    id: '1',
    title: 'Clean Code',
    author: 'Robert Martin',
    availableQuantity: 2
  };

  it('should display book information', () => {
    render(BookCard, { book: mockBook });
    
    expect(screen.getByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText('by Robert Martin')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('should call onBorrow when borrow button clicked', async () => {
    const onBorrow = vi.fn();
    render(BookCard, { book: mockBook, onBorrow });
    
    await screen.getByRole('button', { name: 'Borrow' }).click();
    expect(onBorrow).toHaveBeenCalledWith(mockBook.id);
  });

  it('should disable borrow button when no copies available', () => {
    const unavailableBook = { ...mockBook, availableQuantity: 0 };
    render(BookCard, { book: unavailableBook });
    
    expect(screen.getByRole('button', { name: 'Borrow' })).toBeDisabled();
    expect(screen.getByText('Borrowed')).toBeInTheDocument();
  });
});
```

## Integration Testing

### Database Integration
```typescript
// tests/integration/database.test.ts
describe('Database Integration', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = await createTestDatabase();
    await runMigrations(db);
  });

  afterEach(async () => {
    await cleanupDatabase(db);
  });

  it('should enforce tenant isolation at database level', async () => {
    const library1 = await createLibrary(db, 'Library 1');
    const library2 = await createLibrary(db, 'Library 2');
    
    const book1 = await createBook(db, library1.id, 'Book 1');
    const book2 = await createBook(db, library2.id, 'Book 2');
    
    const books1 = await getBooksByLibrary(db, library1.id);
    expect(books1).toHaveLength(1);
    expect(books1[0].title).toBe('Book 1');
    
    const books2 = await getBooksByLibrary(db, library2.id);
    expect(books2).toHaveLength(1);
    expect(books2[0].title).toBe('Book 2');
  });
});
```

## End-to-End Testing

### Playwright E2E Tests
```typescript
// tests/e2e/borrowing-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Borrowing Workflow', () => {
  test('complete borrowing flow', async ({ page }) => {
    // Login as library reader
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'reader@techcorp.com');
    await page.click('[data-testid=send-code-button]');
    
    // Mock verification code
    await page.fill('[data-testid=code-input]', '123456');
    await page.click('[data-testid=verify-button]');
    
    // Navigate to books
    await page.goto('/books');
    await expect(page.locator('[data-testid=book-list]')).toBeVisible();
    
    // Borrow a book
    await page.click('[data-testid=book-card]:first-child [data-testid=borrow-button]');
    await expect(page.locator('[data-testid=borrow-confirmation]')).toBeVisible();
    await page.click('[data-testid=confirm-borrow]');
    
    // Verify borrowing success
    await expect(page.locator('[data-testid=success-message]')).toContainText('Book borrowed successfully');
    
    // Check borrowing history
    await page.goto('/profile/borrowing');
    await expect(page.locator('[data-testid=borrowed-books]')).toContainText('Clean Code');
  });
});
```

## Test Data Management

### Test Fixtures
```typescript
// tests/fixtures/library.ts
export const createTestLibrary = (overrides = {}) => ({
  id: 'lib-123',
  name: 'Test Library',
  emailDomains: ['@test.com'],
  settings: {
    borrowingPeriodDays: 14,
    maxBooksPerReader: 5,
    allowExtensions: true
  },
  ...overrides
});

export const createTestBook = (overrides = {}) => ({
  id: 'book-123',
  isbn: '978-0132350884',
  title: 'Clean Code',
  author: 'Robert Martin',
  libraryId: 'lib-123',
  availableQuantity: 3,
  ...overrides
});
```

### Database Seeding
```typescript
// tests/utils/seed.ts
export async function seedTestData(db: D1Database) {
  const library = await createLibrary(db, {
    name: 'Test Library',
    emailDomains: ['@test.com']
  });
  
  const admin = await createUser(db, {
    email: 'admin@test.com',
    role: 'library_admin',
    libraryId: library.id
  });
  
  const reader = await createUser(db, {
    email: 'reader@test.com',
    role: 'library_reader',
    libraryId: library.id
  });
  
  const books = await Promise.all([
    createBook(db, { title: 'Clean Code', libraryId: library.id }),
    createBook(db, { title: 'Design Patterns', libraryId: library.id })
  ]);
  
  return { library, admin, reader, books };
}
```

## Testing Guidelines

### Test Organization
- **Unit tests**: `src/**/*.test.ts` - Test individual functions and classes
- **Component tests**: `src/**/*.component.test.ts` - Test Svelte components
- **Integration tests**: `tests/integration/**/*.test.ts` - Test API and database
- **E2E tests**: `tests/e2e/**/*.spec.ts` - Test complete user workflows
- **BDD features**: `tests/features/**/*.feature` - Gherkin scenarios

### Test Naming Conventions
```typescript
// Good: Descriptive test names
describe('Library Aggregate', () => {
  it('should create library with valid email domains', () => {});
  it('should reject user with non-matching email domain', () => {});
  it('should update settings and emit domain event', () => {});
});

// Bad: Vague test names
describe('Library', () => {
  it('should work', () => {});
  it('test creation', () => {});
});
```

### Test Coverage Requirements
- **Minimum 90% code coverage** for domain logic
- **100% coverage** for critical business rules
- **All tRPC procedures** must have integration tests
- **All UI components** must have component tests
- **All user workflows** must have E2E tests

### Mocking Strategy
```typescript
// Mock external dependencies
vi.mock('$lib/services/EmailService', () => ({
  EmailService: {
    sendVerificationCode: vi.fn(),
    sendOverdueNotification: vi.fn()
  }
}));

// Mock tRPC client for component tests
vi.mock('$lib/trpc', () => ({
  trpc: {
    book: {
      list: { query: vi.fn() },
      borrow: { mutate: vi.fn() }
    }
  }
}));
```

### Continuous Integration
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Check coverage
        run: npm run test:coverage
```

## Performance Testing

### Load Testing
```typescript
// tests/performance/load.test.ts
import { test } from '@playwright/test';

test('should handle concurrent borrowing requests', async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 10 }, () => browser.newContext())
  );
  
  const pages = await Promise.all(
    contexts.map(context => context.newPage())
  );
  
  // Simulate concurrent borrowing
  await Promise.all(
    pages.map(async (page, index) => {
      await loginAsReader(page, `reader${index}@test.com`);
      await borrowBook(page, 'Clean Code');
    })
  );
  
  // Verify only one borrowing succeeded
  const borrowedCount = await getBorrowedCount('Clean Code');
  expect(borrowedCount).toBe(1);
});
```

This comprehensive testing strategy ensures that OpenBookCorner maintains high quality, reliability, and correctness throughout development while providing living documentation through BDD scenarios.