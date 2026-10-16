# Hosting Decision

The hosting decision has been consolidated into the finalized architecture decision record:

➡️ **[docs/adr/0001-tech-stack-and-hosting.md](./adr/0001-tech-stack-and-hosting.md)**

Summary: **Phase 1** hosts on **Cloudflare** (Workers + Pages) with **email/password** auth,
using **TanStack Start + shadcn/ui + Hono/tRPC/Drizzle/D1 + Lucia**. **Phase 2** adds WeChat
OAuth login and migrates the interactive/auth path to an in-China, ICP-filed host (e.g. Tencent
CloudBase), keeping Cloudflare for async/static work. **Phase 3** optionally adds a WeChat Mini Program.
