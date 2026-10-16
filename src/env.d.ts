/// <reference types="vite/client" />
/// <reference types="@cloudflare/workers-types" />

// Augment the Cloudflare env type (consumed via `import { env } from 'cloudflare:workers'`)
// with the bindings our Worker declares in wrangler.jsonc.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
  }
}
