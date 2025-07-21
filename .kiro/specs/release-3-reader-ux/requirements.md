# Requirements Document - Release 3: Reader UX Enhancements

## Introduction

This release improves the book discovery and borrowing experience for library members by adding search functionality, pagination, and automated notifications. The goal is to make it easier for members to find books and stay informed about their borrowing status.

## Requirements

### Requirement 1: Catalog Search & Discovery (Slice 7)

**User Story:** As a library member, I want to search for books by title or author and navigate through a paginated catalog so that I can easily find books in larger collections.

#### Acceptance Criteria

1. WHEN a member accesses the catalog THEN they SHALL see a search bar at the top of the page
2. WHEN a member enters text in the search bar THEN the catalog SHALL filter to show books matching the title or author
3. WHEN search results are displayed THEN they SHALL maintain the same format as the full catalog (title, author, availability)
4. WHEN the catalog has more than 20 books THEN pagination SHALL be implemented to display 20 books per page
5. WHEN a member navigates between pages THEN their search query SHALL be preserved
6. WHEN no books match the search criteria THEN a "No books found" message SHALL be displayed
7. WHEN the search bar is cleared THEN the full catalog SHALL be displayed again

### Requirement 2: Automated Due Date Notifications (Slice 8)

**User Story:** As a library member, I want to receive email reminders about my borrowed books so that I can return them on time and avoid overdue status.

#### Acceptance Criteria

1. WHEN a book is 2 days before its due date THEN the system SHALL send an email reminder to the borrower
2. WHEN a book becomes overdue THEN the system SHALL send an overdue notification email to the borrower
3. WHEN overdue notification emails are sent THEN they SHALL be sent daily until the book is returned
4. WHEN a reminder email is sent THEN it SHALL include book title, due date, and return instructions
5. WHEN an overdue email is sent THEN it SHALL include book title, days overdue, and contact information for the librarian
6. WHEN a book is returned THEN no further reminder emails SHALL be sent for that book