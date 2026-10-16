# Project Skills

This directory holds project-specific **Agent Skills** (`SKILL.md` files) that the OpenBookCorner
agent (`.kiro/agents/openbookcorner.json`) loads on demand via the `skill://.kiro/skills/**/SKILL.md`
resource.

## Relationship to TanStack Intent

TanStack's own skills ship **inside the installed npm packages** and are loaded with
`npx @tanstack/intent@latest load <package#skill>` (see `AGENTS.md`). Do **not** copy them here —
Intent keeps them version-matched automatically.

Use this directory only for **project-specific** guidance that isn't owned by a library, e.g.:
- multi-tenant `libraryId` scoping patterns for this codebase
- the project's tRPC procedure conventions (`protectedProcedure` / `adminProcedure`)
- Drizzle schema + migration conventions for D1

## SKILL.md format

Each skill is a folder with a `SKILL.md` that begins with YAML frontmatter:

```markdown
---
name: multi-tenant-queries
description: How to scope Drizzle queries by libraryId in OpenBookCorner. Use when writing any DB access.
---

<guidance body>
```
