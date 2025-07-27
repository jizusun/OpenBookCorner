# SvelteKit 2.26.1 Tutorial

## Table of Contents

1. Introduction
2. File-based Routing
3. Project Setup and Configuration
4. Rendering Modes: SSR, SSG, Client-side Navigation
5. Data Loading with Load Functions
6. Form Actions and API Routes
7. Environment Variables and Configuration
8. Deployment Options
9. Authentication
10. Advanced Topics: Adapters and Hooks
11. Practical Code Examples
12. Further Resources

---

## 1. Introduction

SvelteKit is the official application framework for Svelte, designed for building fast, modern web apps. It provides routing, server-side rendering, static site generation, and more, all powered by Svelte’s compiler.

**How SvelteKit relates to Svelte:**  
Svelte is a UI framework; SvelteKit is the app framework that adds routing, data loading, SSR, and deployment features.

---

## 2. File-based Routing

SvelteKit uses your project’s `src/routes` directory to define routes.

- `src/routes/index.svelte` → `/`
- `src/routes/about.svelte` → `/about`
- Nested folders create nested routes.
- Dynamic routes: `[id].svelte` matches `/123`, `/abc`, etc.

**Example:**

```
src/routes/
  ├── index.svelte
  ├── about.svelte
  └── blog/
      └── [slug].svelte
```

---

## 3. Project Setup and Configuration

**Create a new project:**

```bash
npm create svelte@latest my-app
cd my-app
npm install
npm run dev
```

**Configuration:**  
Edit `svelte.config.js` for adapters, preprocessors, etc.

**Directory structure:**

- `src/routes`: Pages and endpoints
- `src/lib`: Reusable components and utilities
- `static`: Public assets

---

## 4. Rendering Modes

### Server-side Rendering (SSR)

Pages are rendered on the server for fast initial loads and SEO.

### Static Site Generation (SSG)

Pages are pre-rendered at build time.

### Client-side Navigation

SvelteKit uses the browser’s history API for fast, seamless navigation.

**Configure SSR/SSG:**

```js
// svelte.config.js
export default {
  kit: {
    prerender: { default: true },
  },
};
```

---

## 5. Data Loading with Load Functions

Use `+page.js` or `+page.server.js` to load data for a route.

**Client-side load:**

```js
// src/routes/blog/+page.js
export async function load({ fetch }) {
  const res = await fetch("/api/posts");
  return { posts: await res.json() };
}
```

**Server-side load:**

```js
// src/routes/blog/+page.server.js
export async function load({ params }) {
  const post = await getPost(params.slug);
  return { post };
}
```

---

## 6. Form Actions and API Routes

**Form Actions:**  
Use `+page.server.js` to handle form submissions.

```js
// src/routes/contact/+page.server.js
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    // handle form data
    return { success: true };
  },
};
```

**API Routes:**  
Create endpoints with `.js` or `.ts` files.

```js
// src/routes/api/posts/+server.js
export async function GET() {
  return new Response(JSON.stringify(posts));
}
```

---

## 7. Environment Variables and Configuration

- `.env` files for secrets and config.
- Prefix with `PUBLIC_` to expose to client.

**Example:**

```
PUBLIC_API_URL=https://api.example.com
```

Access in code:

```js
import { PUBLIC_API_URL } from "$env/static/public";
```

---

## 8. Deployment Options

SvelteKit supports many platforms via adapters:

- Vercel: `@sveltejs/adapter-vercel`
- Netlify: `@sveltejs/adapter-netlify`
- Static: `@sveltejs/adapter-static`
- Node: `@sveltejs/adapter-node`

**Install and configure:**

```bash
npm install @sveltejs/adapter-vercel
```

```js
// svelte.config.js
import vercel from "@sveltejs/adapter-vercel";
export default {
  kit: { adapter: vercel() },
};
```

---

## 9. Authentication

Use hooks and endpoints for authentication.

**Example:**

```js
// src/hooks.server.js
export async function handle({ event, resolve }) {
  const user = await getUserFromCookie(event.request.headers.get("cookie"));
  event.locals.user = user;
  return resolve(event);
}
```

Check authentication in load functions or endpoints.

---

## 10. Advanced Topics: Adapters and Hooks

**Adapters:**  
Choose an adapter for your deployment target.

**Hooks:**  
Run code on every request (e.g., authentication, logging).

```js
// src/hooks.server.js
export async function handle({ event, resolve }) {
  // custom logic
  return resolve(event);
}
```

---

## 11. Practical Code Examples

**Dynamic Route Example:**

```svelte
<!-- src/routes/blog/[slug].svelte -->
<script>
  export let data;
</script>
<h1>{data.post.title}</h1>
<p>{data.post.content}</p>
```

**Form Example:**

```svelte
<form method="POST">
  <input name="email" type="email" required />
  <button type="submit">Subscribe</button>
</form>
```

---

## 12. Further Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte Discord](https://svelte.dev/chat)
- [Svelte Society](https://sveltesociety.dev/)

---

If you need more details or code samples for any section, let me know!
