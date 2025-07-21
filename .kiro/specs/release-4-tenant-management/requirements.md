# Requirements Document - Release 4: Tenant Management

## Introduction

This release builds out the core SaaS administrative features by adding super admin capabilities for tenant management and librarian role assignment functionality. The goal is to enable the application to scale to multiple organizations with proper administrative controls.

## Requirements

### Requirement 1: Super Admin Tenant Dashboard (Slice 9)

**User Story:** As a super admin, I want to log into a secure dashboard where I can create and manage tenant accounts so that new organizations can be onboarded to the platform.

#### Acceptance Criteria

1. WHEN a super admin accesses the admin dashboard THEN they SHALL be authenticated with elevated permissions
2. WHEN the super admin views the tenant dashboard THEN they SHALL see a list of all existing tenant organizations
3. WHEN the super admin wants to create a new tenant THEN they SHALL be able to enter organization name, domain, and initial librarian details
4. WHEN a new tenant is created THEN the system SHALL set up the tenant's isolated data space and create the initial librarian account
5. WHEN viewing tenant details THEN the super admin SHALL see organization info, member count, and activity status
6. WHEN a tenant needs to be deactivated THEN the super admin SHALL be able to disable access while preserving data

### Requirement 2: Librarian Role Assignment (Slice 10)

**User Story:** As a librarian, I want to view all members in my organization and assign librarian roles to them so that we can have multiple people managing our library.

#### Acceptance Criteria

1. WHEN a librarian accesses the member management view THEN they SHALL see all self-registered members within their tenant
2. WHEN viewing member details THEN the librarian SHALL see member name, email, registration date, and current role
3. WHEN a librarian wants to promote a member THEN they SHALL be able to assign librarian role to that member
4. WHEN a member is promoted to librarian THEN they SHALL immediately gain access to librarian features
5. WHEN a librarian wants to revoke librarian privileges THEN they SHALL be able to change the role back to member
6. WHEN role changes are made THEN the affected user SHALL receive an email notification about their new permissions