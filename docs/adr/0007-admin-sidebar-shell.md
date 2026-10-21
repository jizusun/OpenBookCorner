# 0007 — Admin sidebar shell (shadcn-admin-style navigation)

- Status: Accepted
- Date: 2026-10-21
- Context for: replacing the flat top-nav `_app` layout with a sidebar shell that
  matches the `satnaing/shadcn-admin` look the team liked.

## Context

Our authenticated layout (`routes/_app/route.tsx`) is a single top bar with an
inline nav and a mobile dropdown. As the super-admin console grew (Overview /
Tenants / Users / Books / Audit / System) the flat bar no longer reads as a real
console. We evaluated `satnaing/shadcn-admin` (same stack: React 19, TanStack
Router + Query, Tailwind v4, shadcn/ui) and want its **layout/nav**: a left
sidebar with a brand header, **grouped nav sections with labels**, active-item
highlight, a bottom **user menu**, a collapsible rail, and a mobile sheet.

## Decision

Adopt a **sidebar shell** for the `_app` layout, matching shadcn-admin visually,
built from the **official shadcn `sidebar` + `dropdown-menu` primitives**
(Radix-based) — not a hand-rolled approximation — so it genuinely looks like the
reference.

- **Dependencies (accepted tradeoff)**: this adds `@radix-ui/*` (slot,
  dropdown-menu, + what `sidebar` needs), `tw-animate-css` (the Tailwind v4
  successor to `tailwindcss-animate`), and the shadcn `sidebar`/`dropdown-menu`/
  `sheet`/`separator`/`tooltip` source under `components/ui`. Until now our
  primitives were hand-rolled without Radix; this is a deliberate, scoped
  dependency addition to get a faithful, accessible, maintained shell rather than
  reinventing a focus-trapped collapsible sidebar + menu. Pin exact versions.
- **`components.json`**: add it (aliases → `@/components/ui`, `@/lib/utils`,
  Tailwind v4 / css variables) so future components come via `shadcn add` instead
  of hand-copying.
- **Still NO zustand**: shadcn-admin keeps some UI state in zustand; we do not.
  Sidebar open/collapsed state uses the shadcn `SidebarProvider`'s own
  cookie/local mechanism (component-local), consistent with our library-free
  client-state posture (Query for server data, router context for auth,
  `useSyncExternalStore` for the rare global flag — ADR notes elsewhere).
- **Role-driven nav groups** (not a view switch — ADR superseding the retired
  three-state switch stands): the sidebar renders groups by role/surface:
  - **super_admin → System**: Overview, Tenants, Users, Books, Audit log,
    System settings.
  - **library_admin → Library**: Catalog, Readers, Overdue, Settings, Feedback,
    Activity, Import. Plus the secondary **Reader preview** toggle.
  - **reader (and admin in reader preview) → Reader**: My Books, Scan, Catalog.
  The mapping is a **pure function** `navGroupsFor(role, readerPreview)` so it is
  unit-tested independently of the component.
- **Preserve everything the old layout did**: the persistent `ImpersonationBanner`
  (sticky, above the shell), the reader-preview toggle, Language + Theme toggles,
  the PWA install prompt, Sign out, and i18n (`<Trans>` for every label). These
  move into the sidebar footer / user menu + a slim top bar, not dropped.

## Consequences

- The console looks like shadcn-admin: grouped sidebar + user menu + collapsible.
- New deps (Radix + tw-animate-css + a few shadcn primitives) — a real but
  standard, well-scoped addition; pinned, no zustand.
- Nav logic stays testable (pure `navGroupsFor`); the shell keeps all existing
  testids/behaviors so E2E and component tests continue to assert the same links,
  the `reader-preview-toggle`, and Sign out.
- `components.json` makes further shadcn adoption (command palette, sonner, etc.)
  one command.

## Alternatives considered

- **Hand-roll a lean sidebar** (no Radix): keeps our zero-Radix posture, but
  would not faithfully match shadcn-admin (collapsible rail, accessible menu,
  mobile sheet) and reinvents focus management. Rejected because the team
  specifically likes shadcn-admin's nav.
- **Keep the top-nav**: rejected — doesn't scale to the console's six+ sections.
