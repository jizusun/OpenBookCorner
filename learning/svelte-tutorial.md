# Svelte 5.37.0 Tutorial

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Svelte Components](#svelte-components)
4. [Reactivity in Svelte](#reactivity-in-svelte)
5. [Runes](#runes)
6. [Stores](#stores)
7. [Events](#events)
8. [Lifecycle Functions](#lifecycle-functions)
9. [Context API](#context-api)
10. [Advanced Features](#advanced-features)
11. [Best Practices](#best-practices)
12. [Conclusion](#conclusion)

---

## Introduction

Svelte is a modern JavaScript framework for building fast, reactive user interfaces. Unlike traditional frameworks, Svelte shifts much of the work to compile time, resulting in smaller, faster apps.

**Key Features:**

- No virtual DOM
- Compile-time optimizations
- Simple, readable syntax
- Built-in reactivity

---

## Getting Started

### Installation

To start a new Svelte project:

```bash
npm create svelte@latest my-svelte-app
cd my-svelte-app
npm install
npm run dev
```

Visit `http://localhost:5173` to see your app.

---

## Svelte Components

Components are the building blocks of Svelte apps. Each component is a `.svelte` file containing HTML, CSS, and JavaScript.

**Example: `Hello.svelte`**

```svelte
<script>
  export let name = "World";
</script>

<h1>Hello {name}!</h1>

<style>
  h1 { color: #ff3e00; }
</style>
```

**Usage:**

```svelte
<Hello name="Svelte" />
```

---

## Reactivity in Svelte

Svelte uses assignment to trigger reactivity.

```svelte
<script>
  let count = 0;
  function increment() {
    count += 1; // triggers reactivity
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

---

## Runes

Runes are Svelte’s new reactivity primitives. They provide fine-grained control over reactive state.

**Example:**

```svelte
<script>
  import { $state } from 'svelte';

  const count = $state(0);

  function increment() {
    count.set(count.get() + 1);
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

---

## Stores

Stores are reactive objects for sharing state.

**Writable Store:**

```js
// store.js
import { writable } from "svelte/store";
export const count = writable(0);
```

**Usage:**

```svelte
<script>
  import { count } from './store.js';
</script>

<button on:click={() => $count += 1}>
  Count: {$count}
</button>
```

---

## Events

Svelte uses the `on:event` directive for event handling.

```svelte
<button on:click={() => alert('Clicked!')}>
  Click Me
</button>
```

**Custom Events:**

```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  function send() {
    dispatch('message', { text: 'Hello from child!' });
  }
</script>
<button on:click={send}>Send Message</button>
```

```svelte
<!-- Parent.svelte -->
<Child on:message={e => console.log(e.detail.text)} />
```

---

## Lifecycle Functions

Svelte provides lifecycle functions for component management.

- `onMount`: Runs after the component is first rendered.
- `beforeUpdate`: Runs before the DOM updates.
- `afterUpdate`: Runs after the DOM updates.
- `onDestroy`: Runs when the component is destroyed.

**Example:**

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';

  onMount(() => {
    console.log('Mounted!');
    return () => {
      console.log('Destroyed!');
    };
  });
</script>
```

---

## Context API

Context allows you to pass data deeply without prop drilling.

**Set Context:**

```svelte
<script context="module">
  import { setContext } from 'svelte';
  setContext('theme', 'dark');
</script>
```

**Get Context:**

```svelte
<script>
  import { getContext } from 'svelte';
  const theme = getContext('theme');
</script>
```

---

## Advanced Features

- **Slots:** For component composition.
- **Actions:** For DOM manipulation.
- **Transitions:** For animations.
- **Reactive Statements:** `$:` for derived values.

**Example: Slot**

```svelte
<!-- Box.svelte -->
<slot></slot>
```

**Example: Reactive Statement**

```svelte
<script>
  let a = 1;
  let b = 2;
  $: sum = a + b;
</script>
<p>{sum}</p>
```

---

## Best Practices

- Use runes for fine-grained reactivity.
- Keep components small and focused.
- Use stores for shared state.
- Prefer reactive statements for derived values.
- Use context for global data.
- Avoid unnecessary computations in templates.

---

## Conclusion

Svelte 5.37.0 offers a powerful, modern approach to building web applications. Its compile-time optimizations, simple syntax, and advanced reactivity make it a great choice for developers seeking performance and productivity.

---

If you need more details or code samples for any section, let me know!
