# SvelteKit Tutorial

## Introduction to SvelteKit

### What is SvelteKit?

SvelteKit is a framework for building web applications of all sizes, with a beautiful development experience and flexible filesystem-based routing. It's built on top of Svelte, a revolutionary UI framework that compiles your components at build time rather than interpreting them at runtime in the browser.

SvelteKit is to Svelte what Next.js is to React or Nuxt is to Vue. It's a meta-framework that provides structure, routing, and additional tools to make building complete applications with Svelte easier and more powerful.

### How SvelteKit Relates to Svelte

Svelte is a component framework that compiles your declarative components into efficient JavaScript that surgically updates the DOM. SvelteKit builds on this foundation by adding:

1. **Server-side rendering (SSR)** - Renders pages on the server for faster initial loads and better SEO
2. **Static site generation (SSG)** - Pre-renders pages at build time for optimal performance
3. **Client-side navigation** - After the initial page load, navigates between pages without full page reloads
4. **File-based routing** - Automatically creates routes based on your file structure
5. **Data loading** - Provides mechanisms for loading data before rendering pages
6. **Form handling** - Simplifies working with forms through progressive enhancement
7. **API routes** - Allows you to create API endpoints alongside your pages
8. **Adapters** - Enables deployment to various platforms (Node.js, static hosting, serverless, etc.)

SvelteKit handles the complex infrastructure so you can focus on building your application's features and user experience.

## File-Based Routing System

SvelteKit uses a file-based routing system where the files and directories in your project's `src/routes` directory automatically define the routes of your application.

### Basic Routing Structure

```
src/routes/
├── +page.svelte        # Home page (/)
├── about/
│   └── +page.svelte    # About page (/about)
├── blog/
│   ├── +page.svelte    # Blog index page (/blog)
│   └── [slug]/
│       └── +page.svelte # Individual blog post (/blog/post-1, /blog/post-2, etc.)
```

### Route Files

SvelteKit uses special files with "+" prefixes to define different aspects of a route:

- **+page.svelte** - The page component (UI)
- **+page.ts** or **+page.js** - Page data loading
- **+page.server.ts** or **+page.server.js** - Server-only page data loading
- **+layout.svelte** - Layout component that wraps pages
- **+layout.ts** or **+layout.js** - Layout data loading
- **+layout.server.ts** or **+layout.server.js** - Server-only layout data loading
- **+server.ts** or **+server.js** - API endpoints
- **+error.svelte** - Custom error page

### Dynamic Routes

You can create dynamic routes using square brackets in the directory or file name:

```
src/routes/
├── products/
│   └── [id]/
│       └── +page.svelte    # Matches /products/1, /products/2, etc.
```

In your component, you can access the dynamic parameter:

```svelte
<script>
  import { page } from '$app/stores';
  
  // Access the 'id' parameter
  const productId = $page.params.id;
</script>

<h1>Product {productId}</h1>
```

### Route Groups

You can create route groups using parentheses, which won't affect the URL path:

```
src/routes/
├── (auth)/
│   ├── login/
│   │   └── +page.svelte    # /login
│   └── register/
│       └── +page.svelte    # /register
```

### Nested Layouts

Layouts allow you to share UI elements across multiple pages:

```
src/routes/
├── +layout.svelte          # Applied to all routes
├── dashboard/
│   ├── +layout.svelte      # Applied to all dashboard routes
│   ├── +page.svelte        # /dashboard
│   └── settings/
│       └── +page.svelte    # /dashboard/settings
```

### Rest Parameters

You can capture multiple path segments using rest parameters with ellipses:

```
src/routes/
├── files/
│   └── [...path]/
│       └── +page.svelte    # Matches /files/a, /files/a/b, /files/a/b/c, etc.
```

Access the path segments:

```svelte
<script>
  import { page } from '$app/stores';
  
  // For /files/a/b/c, path will be ['a', 'b', 'c']
  const pathSegments = $page.params.path.split('/');
</script>
```#
# Project Setup and Configuration

### Prerequisites

Before getting started with SvelteKit, ensure you have:

- Node.js (version 16.14 or later)
- npm, pnpm, or yarn installed

### Creating a New SvelteKit Project

The easiest way to create a new SvelteKit project is using the create-svelte tool:

```bash
# Using npm
npm create svelte@latest my-sveltekit-app

# Using pnpm
pnpm create svelte@latest my-sveltekit-app

# Using yarn
yarn create svelte my-sveltekit-app
```

This will prompt you with several options:

1. Choose a template:
   - **Skeleton project** - Bare-bones SvelteKit project
   - **Demo app** - Example app with some pre-built features
   - **Library project** - For creating Svelte component libraries

2. Add TypeScript support (recommended)
3. Add ESLint for code linting
4. Add Prettier for code formatting
5. Add Playwright for browser testing
6. Add Vitest for unit testing

After creating the project, navigate to the project directory and install dependencies:

```bash
cd my-sveltekit-app
npm install
```

### Project Structure

A typical SvelteKit project structure looks like this:

```
my-sveltekit-app/
├── .svelte-kit/        # Build directory (don't edit)
├── node_modules/       # Dependencies
├── src/
│   ├── lib/            # Your library code
│   │   ├── components/ # Svelte components
│   │   ├── server/     # Server-only code
│   │   └── ...
│   ├── params/         # Parameter matchers
│   ├── routes/         # Routes
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   └── ...
│   └── app.html        # HTML template
├── static/             # Static assets
├── tests/              # Test files
├── .eslintrc.cjs       # ESLint configuration
├── .gitignore
├── .prettierrc         # Prettier configuration
├── package.json        # Project metadata and dependencies
├── svelte.config.js    # SvelteKit configuration
├── tsconfig.json       # TypeScript configuration
└── vite.config.js      # Vite configuration
```

### Running the Development Server

To start the development server:

```bash
npm run dev

# Or to open the browser automatically
npm run dev -- --open
```

This will start a local development server, typically at `http://localhost:5173`.

### Configuration Files

#### svelte.config.js

The main SvelteKit configuration file:

```javascript
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Preprocessor for your Svelte components
  preprocess: vitePreprocess(),
  
  kit: {
    // Adapter determines how your app is built for production
    adapter: adapter(),
    
    // Customize aliases
    alias: {
      $components: 'src/lib/components',
      $utils: 'src/lib/utils'
    }
  }
};

export default config;
```

#### vite.config.js

Configuration for Vite, the build tool used by SvelteKit:

```javascript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  
  // Add custom Vite configuration
  server: {
    port: 3000
  }
});
```

### Adapters

SvelteKit uses adapters to build your app for different platforms:

- **@sveltejs/adapter-auto** - Automatically chooses the right adapter based on your deployment platform
- **@sveltejs/adapter-node** - For Node.js environments
- **@sveltejs/adapter-static** - For static site generation
- **@sveltejs/adapter-vercel** - For Vercel deployment
- **@sveltejs/adapter-netlify** - For Netlify deployment
- **@sveltejs/adapter-cloudflare** - For Cloudflare Pages

To change the adapter:

1. Install the adapter:
   ```bash
   npm install @sveltejs/adapter-node
   ```

2. Update your `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-node';
   
   export default {
     kit: {
       adapter: adapter()
     }
   };
   ```

## Server-Side Rendering, Static Site Generation, and Client-Side Navigation

SvelteKit provides multiple rendering strategies to optimize your application for different use cases.

### Server-Side Rendering (SSR)

By default, SvelteKit uses server-side rendering, which means:

1. When a user visits a page, the server renders the HTML
2. The server sends the complete HTML to the browser
3. The browser displays the page immediately
4. JavaScript loads and "hydrates" the page, making it interactive

Benefits of SSR:
- Faster initial page load
- Better SEO (search engines see the full content)
- Works without JavaScript (to some extent)
- Better performance on low-powered devices

Example of a server-rendered page:

```svelte
<!-- src/routes/+page.svelte -->
<script>
  /** @type {import('./$types').PageData} */
  export let data;
</script>

<h1>Welcome, {data.user.name}!</h1>
<p>This page was rendered on the server at {data.timestamp}</p>
```

```javascript
// src/routes/+page.server.js
/** @type {import('./$types').PageServerLoad} */
export async function load() {
  return {
    user: { name: 'Alice' },
    timestamp: new Date().toISOString()
  };
}
```

### Static Site Generation (SSG)

For pages that don't need dynamic server rendering, you can use static site generation:

```javascript
// src/routes/blog/[slug]/+page.js
export const prerender = true;

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const post = await import(`../../../posts/${params.slug}.md`);
  
  return {
    title: post.metadata.title,
    content: post.default
  };
}
```

To prerender your entire site, set the `prerender` option in your `svelte.config.js`:

```javascript
export default {
  kit: {
    prerender: {
      default: true
    }
  }
};
```

### Client-Side Navigation

After the initial page load, SvelteKit uses client-side navigation for faster page transitions:

1. When a user clicks a link, SvelteKit intercepts the click
2. It fetches the new page data using JavaScript
3. It updates only the parts of the page that need to change
4. The browser's URL is updated without a full page reload

This provides a smooth, app-like experience while maintaining the benefits of server rendering for the initial load.

### Controlling Rendering Behavior

You can control rendering behavior at different levels:

#### Page-Level Control

```javascript
// src/routes/static-page/+page.js
export const prerender = true;  // Static generation

// src/routes/dynamic-page/+page.js
export const ssr = true;        // Server-side rendering

// src/routes/client-only/+page.js
export const ssr = false;       // Client-side rendering only
```

#### Route-Level Control

```javascript
// src/routes/blog/[slug]/+page.js
export const prerender = 'auto'; // Prerender if possible, otherwise SSR
```

#### App-Level Control

In `svelte.config.js`:

```javascript
export default {
  kit: {
    prerender: {
      default: true,      // Prerender all pages by default
      entries: ['*'],     // Prerender all pages
      handleMissingId: 'ignore' // How to handle missing dynamic params
    }
  }
};
```##
 Data Loading with Load Functions

SvelteKit provides a powerful data loading system through "load functions" that fetch data for your pages and layouts.

### Page Load Functions

Load functions run before a page is rendered and provide data to the page component:

```javascript
// src/routes/products/+page.js
/** @type {import('./$types').PageLoad} */
export async function load({ fetch, params, url }) {
  const response = await fetch('/api/products');
  const products = await response.json();
  
  return {
    products,
    currentPage: Number(url.searchParams.get('page') || '1')
  };
}
```

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  /** @type {import('./$types').PageData} */
  export let data;
  
  const { products, currentPage } = data;
</script>

<h1>Products (Page {currentPage})</h1>

<ul>
  {#each products as product}
    <li>{product.name} - ${product.price}</li>
  {/each}
</ul>
```

### Server Load Functions

For data that should only be loaded on the server (like database queries or sensitive API calls), use server load functions:

```javascript
// src/routes/dashboard/+page.server.js
import { db } from '$lib/server/database';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
  // This code only runs on the server
  const user = locals.user;
  
  if (!user) {
    throw error(401, 'Not authenticated');
  }
  
  const stats = await db.getUserStats(user.id);
  
  return {
    stats,
    lastLogin: user.lastLogin
  };
}
```

### Layout Load Functions

Load functions can also be used in layouts to share data across multiple pages:

```javascript
// src/routes/+layout.server.js
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ cookies }) {
  const theme = cookies.get('theme') || 'light';
  const user = await getUserFromSession(cookies.get('sessionid'));
  
  return {
    theme,
    user
  };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  /** @type {import('./$types').LayoutData} */
  export let data;
  
  const { theme, user } = data;
</script>

<div class="app" data-theme={theme}>
  <header>
    {#if user}
      <p>Welcome, {user.name}</p>
    {:else}
      <a href="/login">Log in</a>
    {/if}
  </header>
  
  <main>
    <slot></slot>
  </main>
  
  <footer>
    <p>© 2023 My App</p>
  </footer>
</div>
```

### Load Function Parameters

Load functions receive a context object with useful properties:

- **fetch** - A version of `fetch` that includes cookies and follows redirects
- **params** - Route parameters (e.g., `[slug]` becomes `params.slug`)
- **url** - The URL of the request
- **route** - Information about the current route
- **depends** - Function to declare dependencies for invalidation
- **parent** - Function to access data from parent layouts
- **locals** - Server-only object for passing data between hooks and endpoints

### Universal vs. Server Load Functions

- **Universal load functions** (`+page.js`, `+layout.js`) run on both server and client
- **Server load functions** (`+page.server.js`, `+layout.server.js`) run only on the server

### Data Invalidation

You can invalidate data when something changes:

```javascript
// src/routes/todos/+page.js
/** @type {import('./$types').PageLoad} */
export async function load({ fetch, depends }) {
  // Register a dependency on 'todos'
  depends('todos');
  
  const response = await fetch('/api/todos');
  return { todos: await response.json() };
}
```

Then, after modifying todos:

```javascript
// src/routes/todos/+page.svelte
<script>
  import { invalidate } from '$app/navigation';
  
  async function addTodo(todo) {
    await fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify(todo)
    });
    
    // Invalidate the 'todos' dependency
    await invalidate('todos');
  }
</script>
```

### Accessing Parent Data

You can access data from parent layouts:

```javascript
// src/routes/dashboard/settings/+page.js
/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
  // Get data from the parent layout
  const parentData = await parent();
  
  return {
    // Add new data
    settings: await fetchSettings(),
    // Include user from parent
    user: parentData.user
  };
}
```

## Form Actions and API Routes

SvelteKit provides powerful tools for handling forms and creating API endpoints.

### Form Actions

Form actions allow you to handle form submissions with progressive enhancement - they work without JavaScript but provide enhanced behavior when JavaScript is available.

#### Basic Form Action

```javascript
// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    if (!email || !password) {
      return fail(400, { 
        email, 
        missing: true 
      });
    }
    
    try {
      const user = await login(email, password);
      cookies.set('sessionid', user.sessionId, { path: '/' });
      throw redirect(303, '/dashboard');
    } catch (error) {
      return fail(401, { 
        email, 
        incorrect: true 
      });
    }
  }
};
```

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  /** @type {import('./$types').ActionData} */
  export let form;
</script>

<form method="POST">
  <div>
    <label for="email">Email</label>
    <input 
      id="email" 
      name="email" 
      type="email" 
      value={form?.email ?? ''} 
      required
    />
  </div>
  
  <div>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required />
  </div>
  
  {#if form?.missing}
    <p class="error">Please provide both email and password</p>
  {/if}
  
  {#if form?.incorrect}
    <p class="error">Invalid email or password</p>
  {/if}
  
  <button type="submit">Log in</button>
</form>
```

#### Named Form Actions

You can define multiple actions in a single page:

```javascript
// src/routes/todos/+page.server.js
/** @type {import('./$types').Actions} */
export const actions = {
  create: async ({ request }) => {
    const data = await request.formData();
    const title = data.get('title');
    
    await db.createTodo({ title });
    return { success: true };
  },
  
  delete: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id');
    
    await db.deleteTodo(id);
    return { success: true };
  }
};
```

```svelte
<!-- src/routes/todos/+page.svelte -->
<form method="POST" action="?/create">
  <input name="title" required />
  <button>Add todo</button>
</form>

{#each data.todos as todo}
  <form method="POST" action="?/delete">
    <input type="hidden" name="id" value={todo.id} />
    <button>Delete</button>
  </form>
{/each}
```

### Using the `use:enhance` Directive

The `use:enhance` directive progressively enhances forms to prevent full page reloads:

```svelte
<script>
  import { enhance } from '$app/forms';
</script>

<form method="POST" use:enhance>
  <!-- Form fields -->
</form>
```

You can customize the behavior:

```svelte
<form method="POST" use:enhance={({ form, data, action, cancel }) => {
  // Before the form is submitted
  
  return async ({ result, update }) => {
    // After the form is submitted
    
    if (result.type === 'success') {
      // Handle success
    }
    
    // Update the form with the result
    await update();
  };
}}>
  <!-- Form fields -->
</form>
```

### API Routes

API routes allow you to create server endpoints for handling API requests:

```javascript
// src/routes/api/products/+server.js
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
  const category = url.searchParams.get('category');
  const products = await db.getProducts({ category });
  
  return json(products);
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  const product = await request.json();
  const newProduct = await db.createProduct(product);
  
  return json(newProduct, { status: 201 });
}
```

### Dynamic API Routes

You can create dynamic API routes:

```javascript
// src/routes/api/products/[id]/+server.js
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
  const product = await db.getProduct(params.id);
  
  if (!product) {
    return new Response('Product not found', { status: 404 });
  }
  
  return json(product);
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ params, request }) {
  const updates = await request.json();
  const updated = await db.updateProduct(params.id, updates);
  
  return json(updated);
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params }) {
  await db.deleteProduct(params.id);
  
  return new Response(null, { status: 204 });
}
```## 
Environment Variables and Configuration

SvelteKit provides a structured way to work with environment variables and configuration settings.

### Environment Variables

SvelteKit uses Vite's environment variable system, which distinguishes between:

- **Public variables** (prefixed with `PUBLIC_`) - Available in both server and client code
- **Private variables** - Only available in server code

#### Setting Environment Variables

Create a `.env` file in your project root:

```
# Public variables (available everywhere)
PUBLIC_API_URL=https://api.example.com

# Private variables (server-only)
DATABASE_URL=postgres://user:password@localhost:5432/db
SECRET_KEY=your-secret-key
```

For different environments, you can use:
- `.env` - Default for all environments
- `.env.development` - Development environment
- `.env.production` - Production environment

#### Accessing Environment Variables

In server-side code (like `+page.server.js` or `+server.js`):

```javascript
// Access both public and private variables
import { env } from '$env/dynamic/private';

console.log(env.DATABASE_URL);
console.log(env.PUBLIC_API_URL);
```

In universal code (like `+page.js` or components):

```javascript
// Access only public variables
import { PUBLIC_API_URL } from '$env/static/public';

console.log(PUBLIC_API_URL);
```

### Runtime Configuration

For configuration that needs to be determined at runtime:

```javascript
// src/hooks.server.js
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // Add runtime configuration to `locals`
  event.locals.config = {
    theme: process.env.THEME || 'light',
    features: {
      comments: process.env.ENABLE_COMMENTS === 'true'
    }
  };
  
  return resolve(event);
}
```

Then access it in server load functions:

```javascript
// src/routes/+layout.server.js
/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals }) {
  return {
    config: locals.config
  };
}
```

### App Configuration

For app-wide configuration, you can use the `$app/environment` module:

```javascript
import { browser, dev, building } from '$app/environment';

if (dev) {
  // Development-only code
}

if (browser) {
  // Browser-only code
}

if (building) {
  // Code that runs during build
}
```

### Static Configuration

For static configuration that doesn't change:

```javascript
// src/lib/config.js
export const config = {
  siteName: 'My SvelteKit App',
  description: 'A powerful SvelteKit application',
  socialLinks: {
    twitter: 'https://twitter.com/myapp',
    github: 'https://github.com/myapp'
  }
};
```

Then import it where needed:

```javascript
import { config } from '$lib/config';

console.log(config.siteName);
```

## Deployment Options

SvelteKit applications can be deployed to various platforms using adapters.

### Node.js Deployment

For traditional Node.js hosting:

1. Install the Node adapter:
   ```bash
   npm install @sveltejs/adapter-node
   ```

2. Update `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-node';
   
   export default {
     kit: {
       adapter: adapter()
     }
   };
   ```

3. Build your app:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   node build
   ```

### Static Site Deployment

For static hosting (GitHub Pages, Netlify, Vercel, etc.):

1. Install the static adapter:
   ```bash
   npm install @sveltejs/adapter-static
   ```

2. Update `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-static';
   
   export default {
     kit: {
       adapter: adapter({
         pages: 'build',
         assets: 'build',
         fallback: 'index.html',
         precompress: false
       })
     }
   };
   ```

3. Ensure all routes can be prerendered:
   ```javascript
   // src/routes/+layout.js
   export const prerender = true;
   ```

4. Build your app:
   ```bash
   npm run build
   ```

5. Deploy the `build` directory to your hosting provider.

### Vercel Deployment

For Vercel:

1. Install the Vercel adapter:
   ```bash
   npm install @sveltejs/adapter-vercel
   ```

2. Update `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-vercel';
   
   export default {
     kit: {
       adapter: adapter()
     }
   };
   ```

3. Deploy using the Vercel CLI or GitHub integration.

### Netlify Deployment

For Netlify:

1. Install the Netlify adapter:
   ```bash
   npm install @sveltejs/adapter-netlify
   ```

2. Update `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-netlify';
   
   export default {
     kit: {
       adapter: adapter()
     }
   };
   ```

3. Create a `netlify.toml` file:
   ```toml
   [build]
     command = "npm run build"
     publish = "build"
   ```

4. Deploy using the Netlify CLI or GitHub integration.

### Cloudflare Pages Deployment

For Cloudflare Pages:

1. Install the Cloudflare adapter:
   ```bash
   npm install @sveltejs/adapter-cloudflare
   ```

2. Update `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-cloudflare';
   
   export default {
     kit: {
       adapter: adapter()
     }
   };
   ```

3. Deploy using Cloudflare Pages' GitHub integration or Wrangler CLI.

## Authentication in SvelteKit

SvelteKit doesn't include built-in authentication, but it provides the tools to implement various authentication strategies.

### Session-Based Authentication

Using cookies and server-side sessions:

```javascript
// src/hooks.server.js
import { db } from '$lib/server/database';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const sessionId = event.cookies.get('sessionid');
  
  if (sessionId) {
    const session = await db.getSession(sessionId);
    
    if (session) {
      event.locals.user = session.user;
    }
  }
  
  const response = await resolve(event);
  
  return response;
}
```

```javascript
// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    try {
      const { user, sessionId } = await db.login(email, password);
      
      cookies.set('sessionid', sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      throw redirect(303, '/dashboard');
    } catch (error) {
      return fail(401, { email, incorrect: true });
    }
  }
};
```

### Protected Routes

Protecting routes from unauthorized access:

```javascript
// src/hooks.server.js
import { redirect } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // Check if the route requires authentication
  if (event.url.pathname.startsWith('/dashboard')) {
    if (!event.locals.user) {
      throw redirect(303, `/login?redirectTo=${event.url.pathname}`);
    }
  }
  
  return resolve(event);
}
```

### Role-Based Access Control

Implementing role-based permissions:

```javascript
// src/lib/server/auth.js
export function hasPermission(user, permission) {
  if (!user) return false;
  
  const permissions = {
    admin: ['read', 'write', 'delete'],
    editor: ['read', 'write'],
    viewer: ['read']
  };
  
  return permissions[user.role]?.includes(permission) || false;
}
```

```javascript
// src/routes/admin/+layout.server.js
import { redirect } from '@sveltejs/kit';
import { hasPermission } from '$lib/server/auth';

/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals }) {
  if (!hasPermission(locals.user, 'delete')) {
    throw redirect(303, '/dashboard');
  }
  
  return {
    user: locals.user
  };
}
```

### OAuth Authentication

Implementing OAuth with a provider like Google:

```javascript
// src/routes/auth/google/+server.js
import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export function GET({ url, cookies }) {
  const state = crypto.randomUUID();
  cookies.set('oauth_state', state, { path: '/', httpOnly: true });
  
  const redirectUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  redirectUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  redirectUrl.searchParams.set('redirect_uri', `${url.origin}/auth/google/callback`);
  redirectUrl.searchParams.set('response_type', 'code');
  redirectUrl.searchParams.set('scope', 'email profile');
  redirectUrl.searchParams.set('state', state);
  
  throw redirect(303, redirectUrl.toString());
}
```

```javascript
// src/routes/auth/google/callback/+server.js
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('oauth_state');
  
  if (!code || !state || state !== storedState) {
    throw redirect(303, '/login?error=oauth');
  }
  
  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);
    
    // Create or update user
    const user = await db.upsertUser({
      email: userInfo.email,
      name: userInfo.name,
      provider: 'google'
    });
    
    // Create session
    const sessionId = await db.createSession(user.id);
    
    // Set session cookie
    cookies.set('sessionid', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    
    throw redirect(303, '/dashboard');
  } catch (error) {
    console.error('OAuth error:', error);
    throw redirect(303, '/login?error=oauth');
  }
}
```#
# Advanced Topics: Adapters and Hooks

SvelteKit provides advanced features like adapters for deployment and hooks for customizing behavior.

### Adapters

Adapters transform your SvelteKit application into a format suitable for different deployment targets.

#### How Adapters Work

1. You build your app with `npm run build`
2. The adapter processes the build output
3. The result is a deployable application for your target platform

#### Custom Adapter Configuration

Most adapters accept configuration options:

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      // Node.js adapter options
      out: 'build',           // Output directory
      precompress: true,      // Precompress assets
      envPrefix: 'APP_',      // Environment variable prefix
      polyfill: true          // Include Node.js polyfills
    })
  }
};
```

#### Creating a Custom Adapter

For specialized deployment targets, you can create a custom adapter:

```javascript
// my-custom-adapter.js
/** @type {import('@sveltejs/kit').Adapter} */
export default function myAdapter(options = {}) {
  return {
    name: 'my-custom-adapter',
    
    async adapt(builder) {
      // Clear the output directory
      builder.rimraf(options.out || 'build');
      
      // Copy client assets
      builder.writeClient(options.out + '/client');
      
      // Copy server assets
      builder.writeServer(options.out + '/server');
      
      // Generate the server entry point
      builder.writePrerendered(options.out + '/prerendered');
      
      // Create any additional files needed
      builder.copy('package.json', options.out + '/package.json');
    }
  };
}
```

### Hooks

Hooks allow you to intercept and modify requests and responses.

#### Server Hooks

Server hooks run on the server and can modify requests and responses:

```javascript
// src/hooks.server.js
import { sequence } from '@sveltejs/kit/hooks';

/** @type {import('@sveltejs/kit').Handle} */
export const handleAuth = async ({ event, resolve }) => {
  // Get the session from cookies
  const sessionid = event.cookies.get('sessionid');
  
  if (sessionid) {
    // Fetch the user from the database
    event.locals.user = await getUser(sessionid);
  }
  
  return resolve(event);
};

/** @type {import('@sveltejs/kit').Handle} */
export const handleErrors = async ({ event, resolve }) => {
  try {
    return await resolve(event);
  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

// Combine multiple hooks using sequence
export const handle = sequence(handleAuth, handleErrors);
```

#### Available Server Hooks

- **handle** - Process requests and responses
- **handleFetch** - Customize fetch requests made in load functions
- **handleError** - Handle errors during server-side rendering
- **externalFetch** - Customize external fetch requests

#### Client Hooks

Client hooks run in the browser:

```javascript
// src/hooks.client.js
/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, event }) {
  // Log client-side errors
  console.error('Client error:', error);
  
  // Report to error tracking service
  reportError(error, {
    url: event.url.pathname,
    user: localStorage.getItem('userId')
  });
}
```

#### Customizing Fetch Behavior

You can customize how SvelteKit makes fetch requests:

```javascript
// src/hooks.server.js
/** @type {import('@sveltejs/kit').HandleFetch} */
export async function handleFetch({ request, fetch }) {
  // Clone the request to modify it
  const url = new URL(request.url);
  
  // Add API key to requests to your API
  if (url.hostname === 'api.yourservice.com') {
    url.searchParams.set('apikey', process.env.API_KEY);
    
    // Create a new request with the modified URL
    request = new Request(
      url.toString(),
      request
    );
  }
  
  return fetch(request);
}
```

#### External Fetch

For security reasons, SvelteKit restricts which domains can be fetched during server-side rendering. You can customize this behavior:

```javascript
// src/hooks.server.js
/** @type {import('@sveltejs/kit').ExternalFetch} */
export function externalFetch(request) {
  // Allow requests to specific domains
  if (request.url.startsWith('https://api.example.com/')) {
    // You can modify the request if needed
    return request;
  }
  
  // Block other external requests
  throw new Error(`Unauthorized external request to ${request.url}`);
}
```

## Practical Examples

Let's explore some practical examples of common SvelteKit patterns.

### Building a Blog

#### Directory Structure

```
src/routes/
├── +layout.svelte
├── +page.svelte
├── blog/
│   ├── +page.svelte
│   ├── +page.server.js
│   └── [slug]/
│       ├── +page.svelte
│       └── +page.server.js
```

#### Blog Index Page

```javascript
// src/routes/blog/+page.server.js
import { db } from '$lib/server/database';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const posts = await db.getPosts({
    limit: 10,
    orderBy: { publishedAt: 'desc' }
  });
  
  return {
    posts: posts.map(post => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      publishedAt: post.publishedAt
    }))
  };
}
```

```svelte
<!-- src/routes/blog/+page.svelte -->
<script>
  /** @type {import('./$types').PageData} */
  export let data;
</script>

<h1>Blog</h1>

<div class="posts">
  {#each data.posts as post}
    <article>
      <h2>
        <a href="/blog/{post.slug}">{post.title}</a>
      </h2>
      <p class="date">{new Date(post.publishedAt).toLocaleDateString()}</p>
      <p>{post.excerpt}</p>
    </article>
  {/each}
</div>
```

#### Blog Post Page

```javascript
// src/routes/blog/[slug]/+page.server.js
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const post = await db.getPostBySlug(params.slug);
  
  if (!post) {
    throw error(404, 'Post not found');
  }
  
  return { post };
}
```

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script>
  /** @type {import('./$types').PageData} */
  export let data;
  
  const { post } = data;
</script>

<article>
  <h1>{post.title}</h1>
  <p class="date">{new Date(post.publishedAt).toLocaleDateString()}</p>
  
  <div class="content">
    {@html post.content}
  </div>
  
  <div class="author">
    <img src={post.author.avatar} alt={post.author.name} />
    <p>Written by {post.author.name}</p>
  </div>
</article>

<a href="/blog">← Back to all posts</a>
```

### Authentication Flow

#### Login Page

```javascript
// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').PageServerLoad} */
export function load({ locals, url }) {
  // Redirect if already logged in
  if (locals.user) {
    throw redirect(303, url.searchParams.get('redirectTo') || '/dashboard');
  }
}

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    if (!email || !password) {
      return fail(400, { email, missing: true });
    }
    
    try {
      const { user, sessionId } = await db.login(email, password);
      
      cookies.set('sessionid', sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      throw redirect(303, url.searchParams.get('redirectTo') || '/dashboard');
    } catch (error) {
      return fail(401, { email, incorrect: true });
    }
  }
};
```

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  /** @type {import('./$types').ActionData} */
  export let form;
  
  import { enhance } from '$app/forms';
</script>

<h1>Login</h1>

<form method="POST" use:enhance>
  <div>
    <label for="email">Email</label>
    <input 
      id="email" 
      name="email" 
      type="email" 
      value={form?.email ?? ''} 
      required
    />
  </div>
  
  <div>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required />
  </div>
  
  {#if form?.missing}
    <p class="error">Please provide both email and password</p>
  {/if}
  
  {#if form?.incorrect}
    <p class="error">Invalid email or password</p>
  {/if}
  
  <button type="submit">Log in</button>
</form>

<p>
  Don't have an account? <a href="/register">Register</a>
</p>
```

#### Protected Dashboard

```javascript
// src/routes/dashboard/+layout.server.js
import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, url }) {
  if (!locals.user) {
    throw redirect(303, `/login?redirectTo=${url.pathname}`);
  }
  
  return {
    user: locals.user
  };
}
```

```svelte
<!-- src/routes/dashboard/+layout.svelte -->
<script>
  /** @type {import('./$types').LayoutData} */
  export let data;
  
  const { user } = data;
</script>

<div class="dashboard">
  <aside>
    <div class="user-info">
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
    </div>
    
    <nav>
      <a href="/dashboard">Overview</a>
      <a href="/dashboard/profile">Profile</a>
      <a href="/dashboard/settings">Settings</a>
      <form method="POST" action="/logout">
        <button type="submit">Log out</button>
      </form>
    </nav>
  </aside>
  
  <main>
    <slot></slot>
  </main>
</div>
```

### REST API with CRUD Operations

```javascript
// src/routes/api/todos/+server.js
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const completed = url.searchParams.get('completed');
  const todos = await db.getTodos({
    userId: locals.user.id,
    completed: completed === 'true' ? true : completed === 'false' ? false : undefined
  });
  
  return json(todos);
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { title } = await request.json();
  
  if (!title) {
    return json({ error: 'Title is required' }, { status: 400 });
  }
  
  const todo = await db.createTodo({
    title,
    userId: locals.user.id
  });
  
  return json(todo, { status: 201 });
}
```

```javascript
// src/routes/api/todos/[id]/+server.js
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/database';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const todo = await db.getTodo(params.id);
  
  if (!todo) {
    return json({ error: 'Todo not found' }, { status: 404 });
  }
  
  if (todo.userId !== locals.user.id) {
    return new Response('Forbidden', { status: 403 });
  }
  
  return json(todo);
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const todo = await db.getTodo(params.id);
  
  if (!todo) {
    return json({ error: 'Todo not found' }, { status: 404 });
  }
  
  if (todo.userId !== locals.user.id) {
    return new Response('Forbidden', { status: 403 });
  }
  
  const updates = await request.json();
  const updatedTodo = await db.updateTodo(params.id, updates);
  
  return json(updatedTodo);
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const todo = await db.getTodo(params.id);
  
  if (!todo) {
    return json({ error: 'Todo not found' }, { status: 404 });
  }
  
  if (todo.userId !== locals.user.id) {
    return new Response('Forbidden', { status: 403 });
  }
  
  await db.deleteTodo(params.id);
  
  return new Response(null, { status: 204 });
}
```

### File Upload Example

```javascript
// src/routes/upload/+page.server.js
import { fail } from '@sveltejs/kit';
import { writeFileSync } from 'fs';
import { join } from 'path';

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }
    
    const data = await request.formData();
    const file = data.get('file');
    
    if (!file || !(file instanceof File)) {
      return fail(400, { error: 'No file uploaded' });
    }
    
    try {
      // Read file content
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Generate unique filename
      const filename = `${Date.now()}-${file.name}`;
      const path = join(process.cwd(), 'static', 'uploads', filename);
      
      // Save file
      writeFileSync(path, buffer);
      
      // Save file metadata to database
      const fileRecord = await saveFileToDatabase({
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        userId: locals.user.id
      });
      
      return { success: true, file: fileRecord };
    } catch (error) {
      console.error('Upload error:', error);
      return fail(500, { error: 'Failed to upload file' });
    }
  }
};
```

```svelte
<!-- src/routes/upload/+page.svelte -->
<script>
  /** @type {import('./$types').ActionData} */
  export let form;
  
  import { enhance } from '$app/forms';
  
  let files;
  let uploading = false;
</script>

<h1>File Upload</h1>

<form
  method="POST"
  enctype="multipart/form-data"
  use:enhance={() => {
    uploading = true;
    
    return ({ result }) => {
      uploading = false;
      files = null;
    };
  }}
>
  <div>
    <label for="file">Choose a file</label>
    <input
      id="file"
      name="file"
      type="file"
      bind:files
      required
    />
  </div>
  
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
  
  {#if form?.success}
    <p class="success">
      File uploaded successfully!
      <a href="/uploads/{form.file.filename}" target="_blank">View file</a>
    </p>
  {/if}
  
  <button type="submit" disabled={uploading}>
    {uploading ? 'Uploading...' : 'Upload'}
  </button>
</form>
```## Res
ources for Further Learning

### Official Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs) - Official documentation with comprehensive guides and API references
- [SvelteKit GitHub Repository](https://github.com/sveltejs/kit) - Source code and issue tracker
- [Svelte Tutorial](https://svelte.dev/tutorial) - Interactive tutorial for learning Svelte basics
- [Svelte Examples](https://svelte.dev/examples) - Collection of small examples demonstrating Svelte features
- [Svelte REPL](https://svelte.dev/repl) - Online playground for experimenting with Svelte

### Community Resources

- [Svelte Society](https://sveltesociety.dev/) - Community-driven collection of Svelte resources, components, and tools
- [SvelteKit Discord](https://discord.com/invite/svelte) - Official Discord server for Svelte and SvelteKit
- [Made with Svelte](https://madewithsvelte.com/) - Showcase of projects built with Svelte and SvelteKit
- [Awesome Svelte](https://github.com/TheComputerM/awesome-svelte) - Curated list of Svelte resources

### Tutorials and Courses

- [Joy of Code](https://joyofcode.xyz/svelte-kit-guide) - Comprehensive SvelteKit guide
- [Learn SvelteKit](https://learn.svelte.dev/) - Official interactive tutorial
- [SvelteKit Crash Course](https://www.youtube.com/watch?v=UU7MgYIbtAk) - YouTube tutorial by Traversy Media
- [Everything Svelte](https://www.youtube.com/playlist?list=PLm_Qt4aKpfKjf77S8UD79Ockhwp_699Ms) - YouTube series by Huntabyte

### Books

- [Svelte and SvelteKit: Up and Running](https://www.amazon.com/Svelte-SvelteKit-Running-Mark-Volkmann/dp/1098113399) - By Mark Volkmann
- [SvelteKit for Enterprise Web Applications](https://www.amazon.com/SvelteKit-Enterprise-Applications-end-end/dp/1801070075) - By Edouard Bozon

### Blogs and Articles

- [Svelte Blog](https://svelte.dev/blog) - Official Svelte blog
- [DEV Community Svelte Tag](https://dev.to/t/svelte) - Articles about Svelte on DEV
- [LogRocket Svelte Blog](https://blog.logrocket.com/tag/svelte/) - Svelte articles on LogRocket

### Tools and Libraries

- [SvelteKit Starter Templates](https://github.com/sveltejs/kit/tree/master/packages/create-svelte) - Official starter templates
- [Skeleton UI](https://www.skeleton.dev/) - UI component library for Svelte and SvelteKit
- [Svelte Forms Lib](https://github.com/tjinauyeung/svelte-forms-lib) - Form validation library
- [SvelteKit Auth](https://authjs.dev/reference/sveltekit) - Authentication for SvelteKit
- [Svelte Query](https://tanstack.com/query/latest/docs/svelte/overview) - Data fetching library for Svelte

## Conclusion

SvelteKit is a powerful framework for building modern web applications. It combines the efficiency and elegance of Svelte with a robust set of features for building complete applications. With its file-based routing, server-side rendering, and flexible deployment options, SvelteKit provides everything you need to build fast, scalable, and maintainable web applications.

By leveraging SvelteKit's features like load functions, form actions, and API routes, you can create rich, interactive experiences while maintaining excellent performance and SEO. The framework's adaptable nature allows it to be used for everything from simple static sites to complex, data-driven applications.

As you continue your journey with SvelteKit, remember that the Svelte and SvelteKit communities are active and supportive. Don't hesitate to explore the resources listed above and engage with the community to deepen your understanding and share your experiences.

Happy coding with SvelteKit!