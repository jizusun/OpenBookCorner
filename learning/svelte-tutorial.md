# Svelte 5.0 Tutorial

A comprehensive guide to building modern web applications with Svelte 5.0.

## Table of Contents

1. [Introduction to Svelte](#introduction-to-svelte)
2. [Core Philosophy](#core-philosophy)
3. [Svelte vs Other Frameworks](#svelte-vs-other-frameworks)
4. [Installation and Project Setup](#installation-and-project-setup)
5. [Basic Syntax and Reactivity Model](#basic-syntax-and-reactivity-model)
6. [Components, Props, and State Management](#components-props-and-state-management)
7. [Lifecycle Methods](#lifecycle-methods)
8. [Event Handling and Binding](#event-handling-and-binding)
9. [Animations and Transitions](#animations-and-transitions)
10. [Best Practices and Common Patterns](#best-practices-and-common-patterns)
11. [Resources for Further Learning](#resources-for-further-learning)

## Introduction to Svelte

Svelte is a radical new approach to building user interfaces. Whereas traditional frameworks like React and Vue do the bulk of their work in the browser, Svelte shifts that work into a compile step that happens when you build your app.

Instead of using techniques like virtual DOM diffing, Svelte writes code that surgically updates the DOM when the state of your app changes. This results in smaller bundle sizes, better performance, and a more enjoyable developer experience.

Svelte 5.0 introduces significant improvements including:

- **Runes**: A new reactivity system that provides more explicit and powerful state management
- **Enhanced performance**: Further optimizations to the compiler and runtime
- **Better TypeScript support**: Improved type inference and better integration
- **Simplified mental model**: Clearer separation between reactive and non-reactive code

## Core Philosophy

Svelte's core philosophy centers around several key principles:

### 1. **Compile-time Optimization**

Svelte moves work from the browser to the build step, generating highly optimized vanilla JavaScript that directly manipulates the DOM.

### 2. **No Virtual DOM**

Instead of using a virtual DOM, Svelte knows at compile time how things could change in your app and generates code to update the DOM efficiently.

### 3. **Write Less Code**

Svelte's design prioritizes reducing boilerplate and making common patterns more concise.

### 4. **No Runtime**

Svelte apps have no framework to ship to your users, resulting in smaller bundle sizes.

### 5. **Progressive Enhancement**

Svelte applications can be built to work without JavaScript, enhancing the experience when JavaScript is available.

## Svelte vs Other Frameworks

### Svelte vs React

| Aspect               | Svelte                         | React                                |
| -------------------- | ------------------------------ | ------------------------------------ |
| **Philosophy**       | Compile-time optimization      | Runtime virtual DOM                  |
| **Bundle Size**      | Smaller (no runtime)           | Larger (includes React library)      |
| **Learning Curve**   | Gentler, closer to vanilla web | Steeper, requires JSX and concepts   |
| **State Management** | Built-in reactivity            | Requires external libraries or hooks |
| **Performance**      | Generally faster               | Good with optimization               |

```svelte
<!-- Svelte Component -->
<script>
  let count = $state(0);

  function increment() {
    count += 1;
  }
</script>

<button onclick={increment}>
  Count: {count}
</button>
```

```jsx
// React Component
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

### Svelte vs Vue

| Aspect                      | Svelte                            | Vue                                  |
| --------------------------- | --------------------------------- | ------------------------------------ |
| **Template Syntax**         | HTML-like with minimal directives | Template syntax with more directives |
| **Reactivity**              | Compile-time reactivity           | Runtime reactivity system            |
| **Component Communication** | Props, events, context            | Props, events, provide/inject        |
| **Ecosystem**               | Smaller but growing               | Large and mature                     |
| **TypeScript Support**      | Good and improving                | Excellent                            |

## Installation and Project Setup

### Prerequisites

Make sure you have Node.js installed (version 18 or higher recommended):

```bash
node --version
npm --version
```

### Creating a New Svelte Project

The easiest way to start a new Svelte project is using the official create-svelte template:

```bash
# Create a new project
npm create svelte@latest my-svelte-app

# Navigate to the project
cd my-svelte-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

A typical Svelte project structure looks like this:

```
my-svelte-app/
├── src/
│   ├── lib/
│   │   └── index.js
│   ├── routes/
│   │   └── +page.svelte
│   ├── app.html
│   └── app.css
├── static/
├── package.json
├── svelte.config.js
├── vite.config.js
└── tsconfig.json (if using TypeScript)
```

### Configuration Files

**svelte.config.js**

```javascript
import adapter from "@sveltejs/adapter-auto";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
```

**vite.config.js**

```javascript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
});
```

## Basic Syntax and Reactivity Model

### Component Structure

A Svelte component consists of three optional sections:

```svelte
<script>
  // JavaScript logic goes here
</script>

<style>
  /* Component-scoped CSS goes here */
</style>

<!-- HTML markup goes here -->
```

### Runes: The New Reactivity System

Svelte 5.0 introduces **runes** - a new way to declare reactive state that's more explicit and powerful than the previous `$:` syntax.

#### State Rune

```svelte
<script>
  let count = $state(0);
  let user = $state({ name: 'John', age: 30 });

  function increment() {
    count += 1;
  }

  function updateUser() {
    user.age += 1;
  }
</script>

<button onclick={increment}>Count: {count}</button>
<button onclick={updateUser}>Age: {user.age}</button>
<p>Hello, {user.name}!</p>
```

#### Derived Rune

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  let message = $derived(`Count is ${count}`);
</script>

<p>Count: {count}</p>
<p>Doubled: {doubled}</p>
<p>{message}</p>
```

#### Effect Rune

```svelte
<script>
  let count = $state(0);

  $effect(() => {
    console.log(`Count changed to: ${count}`);

    // Cleanup function (optional)
    return () => {
      console.log('Cleanup previous effect');
    };
  });
</script>
```

### Reactive Statements (Legacy)

While runes are the recommended approach in Svelte 5.0, reactive statements are still supported:

```svelte
<script>
  let count = 0;

  // Reactive statement
  $: doubled = count * 2;

  // Reactive block
  $: {
    if (count > 10) {
      console.log('Count is getting big!');
    }
  }

  // Reactive statement with side effects
  $: console.log(`Count is now ${count}`);
</script>
```

### Interpolation and Expressions

```svelte
<script>
  let name = $state('World');
  let count = $state(0);
  let items = $state(['apple', 'banana', 'cherry']);
</script>

<!-- Text interpolation -->
<h1>Hello {name}!</h1>

<!-- Expressions -->
<p>2 + 2 = {2 + 2}</p>
<p>Count squared: {count * count}</p>

<!-- Conditional rendering -->
{#if count > 0}
  <p>Count is positive</p>
{:else if count < 0}
  <p>Count is negative</p>
{:else}
  <p>Count is zero</p>
{/if}

<!-- List rendering -->
<ul>
  {#each items as item, index}
    <li>{index}: {item}</li>
  {/each}
</ul>

<!-- Keyed each blocks -->
{#each items as item (item)}
  <div>{item}</div>
{/each}
```

## Components, Props, and State Management

### Creating Components

**Button.svelte**

```svelte
<script>
  let { variant = 'primary', size = 'medium', disabled = false, onclick } = $props();
</script>

<button
  class="btn btn-{variant} btn-{size}"
  {disabled}
  {onclick}
>
  <slot />
</button>

<style>
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-primary {
    background-color: #007bff;
    color: white;
  }

  .btn-secondary {
    background-color: #6c757d;
    color: white;
  }

  .btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }

  .btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 1.125rem;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
```

### Using Components

**App.svelte**

```svelte
<script>
  import Button from './Button.svelte';

  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<main>
  <h1>Component Example</h1>

  <Button onclick={handleClick}>
    Clicked {count} times
  </Button>

  <Button variant="secondary" size="large">
    Large Secondary Button
  </Button>

  <Button disabled>
    Disabled Button
  </Button>
</main>
```

### Props in Svelte 5.0

```svelte
<script>
  // Destructuring props with defaults
  let {
    title = 'Default Title',
    items = [],
    onSelect,
    ...restProps
  } = $props();

  // Props can be reactive
  let itemCount = $derived(items.length);
</script>

<div {...restProps}>
  <h2>{title}</h2>
  <p>Total items: {itemCount}</p>

  {#each items as item}
    <button onclick={() => onSelect?.(item)}>
      {item.name}
    </button>
  {/each}
</div>
```

### Component Communication

#### Parent to Child (Props)

```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  let message = $state('Hello from parent');
  let userData = $state({ name: 'Alice', age: 25 });
</script>

<Child {message} user={userData} />
```

```svelte
<!-- Child.svelte -->
<script>
  let { message, user } = $props();
</script>

<div>
  <p>{message}</p>
  <p>{user.name} is {user.age} years old</p>
</div>
```

#### Child to Parent (Events)

```svelte
<!-- Child.svelte -->
<script>
  let { onCustomEvent } = $props();

  function handleClick() {
    onCustomEvent?.({ detail: 'Data from child' });
  }
</script>

<button onclick={handleClick}>
  Send event to parent
</button>
```

```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  function handleCustomEvent(event) {
    console.log('Received:', event.detail);
  }
</script>

<Child onCustomEvent={handleCustomEvent} />
```

### Context API

For deeper component communication, use Svelte's context API:

```svelte
<!-- Provider.svelte -->
<script>
  import { setContext } from 'svelte';

  let theme = $state('light');

  setContext('theme', {
    get current() { return theme; },
    toggle: () => theme = theme === 'light' ? 'dark' : 'light'
  });
</script>

<div class="app" class:dark={theme === 'dark'}>
  <slot />
</div>
```

```svelte
<!-- Consumer.svelte -->
<script>
  import { getContext } from 'svelte';

  const theme = getContext('theme');
</script>

<div>
  <p>Current theme: {theme.current}</p>
  <button onclick={theme.toggle}>
    Toggle Theme
  </button>
</div>
```

## Lifecycle Methods

Svelte provides several lifecycle functions to hook into component creation and destruction:

```svelte
<script>
  import { onMount, onDestroy, beforeUpdate, afterUpdate } from 'svelte';

  let data = $state(null);
  let intervalId;

  // Runs after component is first rendered to DOM
  onMount(async () => {
    console.log('Component mounted');

    // Fetch initial data
    const response = await fetch('/api/data');
    data = await response.json();

    // Set up interval
    intervalId = setInterval(() => {
      console.log('Interval tick');
    }, 1000);

    // Return cleanup function
    return () => {
      console.log('Mount cleanup');
    };
  });

  // Runs before component is destroyed
  onDestroy(() => {
    console.log('Component destroyed');
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Runs before DOM is updated
  beforeUpdate(() => {
    console.log('Before update');
  });

  // Runs after DOM is updated
  afterUpdate(() => {
    console.log('After update');
  });
</script>

{#if data}
  <div>Data loaded: {JSON.stringify(data)}</div>
{:else}
  <div>Loading...</div>
{/if}
```

### Lifecycle with Runes

In Svelte 5.0, you can often use runes instead of lifecycle functions:

```svelte
<script>
  let count = $state(0);

  // Effect runs on mount and when dependencies change
  $effect(() => {
    console.log('Count changed:', count);

    // Cleanup function
    return () => {
      console.log('Cleaning up effect');
    };
  });

  // Effect that only runs once (like onMount)
  $effect(() => {
    console.log('Component mounted');

    return () => {
      console.log('Component unmounted');
    };
  });
</script>
```

## Event Handling and Binding

### Basic Event Handling

```svelte
<script>
  let count = $state(0);
  let message = $state('');

  function handleClick() {
    count += 1;
  }

  function handleInput(event) {
    message = event.target.value;
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      console.log('Enter pressed:', message);
    }
  }
</script>

<button onclick={handleClick}>
  Clicked {count} times
</button>

<input
  value={message}
  oninput={handleInput}
  onkeydown={handleKeydown}
  placeholder="Type something..."
/>

<p>Message: {message}</p>
```

### Event Modifiers

```svelte
<script>
  function handleSubmit() {
    console.log('Form submitted');
  }

  function handleClick() {
    console.log('Button clicked');
  }
</script>

<!-- Prevent default behavior -->
<form onsubmit|preventDefault={handleSubmit}>
  <input type="text" />
  <button type="submit">Submit</button>
</form>

<!-- Stop propagation -->
<div onclick={() => console.log('Outer clicked')}>
  <button onclick|stopPropagation={handleClick}>
    Click me (won't bubble)
  </button>
</div>

<!-- Run only once -->
<button onclick|once={handleClick}>
  Click me once
</button>

<!-- Capture phase -->
<div onclick|capture={() => console.log('Captured')}>
  <button onclick={() => console.log('Bubbled')}>
    Click me
  </button>
</div>
```

### Two-way Binding

```svelte
<script>
  let name = $state('');
  let email = $state('');
  let age = $state(0);
  let agreed = $state(false);
  let selectedColor = $state('red');
  let selectedColors = $state([]);
  let message = $state('');
</script>

<!-- Text input -->
<input bind:value={name} placeholder="Name" />

<!-- Email input -->
<input type="email" bind:value={email} placeholder="Email" />

<!-- Number input -->
<input type="number" bind:value={age} min="0" max="120" />

<!-- Checkbox -->
<label>
  <input type="checkbox" bind:checked={agreed} />
  I agree to the terms
</label>

<!-- Radio buttons -->
<fieldset>
  <legend>Choose a color:</legend>
  <label>
    <input type="radio" bind:group={selectedColor} value="red" />
    Red
  </label>
  <label>
    <input type="radio" bind:group={selectedColor} value="green" />
    Green
  </label>
  <label>
    <input type="radio" bind:group={selectedColor} value="blue" />
    Blue
  </label>
</fieldset>

<!-- Multi-select -->
<select multiple bind:value={selectedColors}>
  <option value="red">Red</option>
  <option value="green">Green</option>
  <option value="blue">Blue</option>
</select>

<!-- Textarea -->
<textarea bind:value={message} placeholder="Your message"></textarea>

<!-- Display values -->
<div>
  <p>Name: {name}</p>
  <p>Email: {email}</p>
  <p>Age: {age}</p>
  <p>Agreed: {agreed}</p>
  <p>Selected color: {selectedColor}</p>
  <p>Selected colors: {selectedColors.join(', ')}</p>
  <p>Message: {message}</p>
</div>
```

### Custom Events

```svelte
<!-- CustomInput.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  let { value = '', placeholder = '' } = $props();
  let { onCustomChange } = $props();

  function handleInput(event) {
    const newValue = event.target.value;
    onCustomChange?.(newValue);
  }
</script>

<input
  {value}
  {placeholder}
  oninput={handleInput}
/>
```

```svelte
<!-- Parent.svelte -->
<script>
  import CustomInput from './CustomInput.svelte';

  let inputValue = $state('');

  function handleCustomChange(newValue) {
    inputValue = newValue;
    console.log('Input changed:', newValue);
  }
</script>

<CustomInput
  value={inputValue}
  placeholder="Type something..."
  onCustomChange={handleCustomChange}
/>
```

## Animations and Transitions

Svelte provides powerful built-in animation and transition capabilities:

### Basic Transitions

```svelte
<script>
  import { fade, slide, scale, fly } from 'svelte/transition';

  let visible = $state(false);
</script>

<button onclick={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <div transition:fade>Fade in and out</div>
  <div transition:slide>Slide in and out</div>
  <div transition:scale>Scale in and out</div>
  <div transition:fly={{ y: 200, duration: 2000 }}>
    Fly in from below
  </div>
{/if}
```

### Custom Transitions

```svelte
<script>
  import { cubicOut } from 'svelte/easing';

  let visible = $state(false);

  function typewriter(node, { speed = 1 }) {
    const valid = node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE;

    if (!valid) {
      throw new Error(`This transition only works on elements with a single text node child`);
    }

    const text = node.textContent;
    const duration = text.length / (speed * 0.01);

    return {
      duration,
      tick: t => {
        const i = Math.trunc(text.length * t);
        node.textContent = text.slice(0, i);
      }
    };
  }
</script>

<button onclick={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <p transition:typewriter={{ speed: 1 }}>
    This text will appear to be typed out character by character.
  </p>
{/if}
```

### Animations

```svelte
<script>
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';

  let items = $state([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
    { id: 4, name: 'Item 4' }
  ]);

  function shuffle() {
    items = items.slice().sort(() => Math.random() - 0.5);
  }

  function remove(item) {
    items = items.filter(i => i !== item);
  }
</script>

<button onclick={shuffle}>Shuffle</button>

<div class="list">
  {#each items as item (item.id)}
    <div
      class="item"
      animate:flip={{ duration: 300 }}
      transition:fade
    >
      {item.name}
      <button onclick={() => remove(item)}>Remove</button>
    </div>
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f0f0f0;
    border-radius: 0.25rem;
  }
</style>
```

### Motion and Tweening

```svelte
<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  const progress = tweened(0, {
    duration: 400,
    easing: cubicOut
  });

  function handleClick() {
    progress.set(Math.random());
  }
</script>

<button onclick={handleClick}>
  Random progress
</button>

<div class="progress-bar">
  <div
    class="progress-fill"
    style="width: {$progress * 100}%"
  ></div>
</div>

<p>Progress: {Math.round($progress * 100)}%</p>

<style>
  .progress-bar {
    width: 100%;
    height: 20px;
    background: #ddd;
    border-radius: 10px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #45a049);
    transition: width 0.3s ease;
  }
</style>
```

### Spring Animations

```svelte
<script>
  import { spring } from 'svelte/motion';

  let coords = spring({ x: 50, y: 50 }, {
    stiffness: 0.1,
    damping: 0.25
  });

  function handleMousemove(event) {
    coords.set({ x: event.clientX, y: event.clientY });
  }
</script>

<svelte:window onmousemove={handleMousemove} />

<div
  class="circle"
  style="transform: translate({$coords.x}px, {$coords.y}px)"
></div>

<style>
  .circle {
    position: absolute;
    width: 50px;
    height: 50px;
    background: #ff3e00;
    border-radius: 50%;
    pointer-events: none;
    transform-origin: center;
  }
</style>
```

## Best Practices and Common Patterns

### 1. Component Organization

Structure your components with clear separation of concerns:

```svelte
<script>
  // Imports first
  import ChildComponent from './ChildComponent.svelte';
  import { someUtility } from '$lib/utils';

  // Props destructuring
  let { title, items = [], onItemSelect } = $props();

  // Local state
  let searchTerm = $state('');
  let isLoading = $state(false);

  // Derived values
  let filteredItems = $derived(
    items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Functions
  function handleSearch(event) {
    searchTerm = event.target.value;
  }

  async function loadMoreItems() {
    isLoading = true;
    try {
      // Load more items
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- Template -->
<div class="container">
  <!-- Component content -->
</div>

<style>
  /* Component styles */
</style>
```

### 2. State Management Patterns

#### Local State for Simple Components

```svelte
<script>
  let count = $state(0);
  let user = $state({ name: '', email: '' });

  function increment() {
    count += 1;
  }

  function updateUser(field, value) {
    user[field] = value;
  }
</script>
```

#### Context for Shared State

```svelte
<!-- store.js -->
import { getContext, setContext } from 'svelte';

class AppStore {
  constructor() {
    this.user = $state(null);
    this.theme = $state('light');
  }

  login(userData) {
    this.user = userData;
  }

  logout() {
    this.user = null;
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
  }
}

const STORE_KEY = 'app-store';

export function createAppStore() {
  const store = new AppStore();
  setContext(STORE_KEY, store);
  return store;
}

export function getAppStore() {
  return getContext(STORE_KEY);
}
```

### 3. Form Handling

```svelte
<script>
  let form = $state({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  let errors = $state({});
  let isSubmitting = $state(false);

  // Validation
  let isValid = $derived(
    form.name.length > 0 &&
    form.email.includes('@') &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword
  );

  function validateField(field, value) {
    const newErrors = { ...errors };

    switch (field) {
      case 'name':
        if (!value) newErrors.name = 'Name is required';
        else delete newErrors.name;
        break;
      case 'email':
        if (!value.includes('@')) newErrors.email = 'Invalid email';
        else delete newErrors.email;
        break;
      case 'password':
        if (value.length < 8) newErrors.password = 'Password must be 8+ characters';
        else delete newErrors.password;
        break;
      case 'confirmPassword':
        if (value !== form.password) newErrors.confirmPassword = 'Passwords must match';
        else delete newErrors.confirmPassword;
        break;
    }

    errors = newErrors;
  }

  async function handleSubmit() {
    if (!isValid) return;

    isSubmitting = true;
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        // Handle success
        form = { name: '', email: '', password: '', confirmPassword: '' };
      }
    } catch (error) {
      console.error('Submission error:', error);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form onsubmit|preventDefault={handleSubmit}>
  <div class="field">
    <label for="name">Name</label>
    <input
      id="name"
      bind:value={form.name}
      oninput={(e) => validateField('name', e.target.value)}
      class:error={errors.name}
    />
    {#if errors.name}<span class="error-text">{errors.name}</span>{/if}
  </div>

  <div class="field">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bind:value={form.email}
      oninput={(e) => validateField('email', e.target.value)}
      class:error={errors.email}
    />
    {#if errors.email}<span class="error-text">{errors.email}</span>{/if}
  </div>

  <div class="field">
    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      bind:value={form.password}
      oninput={(e) => validateField('password', e.target.value)}
      class:error={errors.password}
    />
    {#if errors.password}<span class="error-text">{errors.password}</span>{/if}
  </div>

  <div class="field">
    <label for="confirmPassword">Confirm Password</label>
    <input
      id="confirmPassword"
      type="password"
      bind:value={form.confirmPassword}
      oninput={(e) => validateField('confirmPassword', e.target.value)}
      class:error={errors.confirmPassword}
    />
    {#if errors.confirmPassword}<span class="error-text">{errors.confirmPassword}</span>{/if}
  </div>

  <button type="submit" disabled={!isValid || isSubmitting}>
    {isSubmitting ? 'Submitting...' : 'Submit'}
  </button>
</form>

<style>
  .field {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: bold;
  }

  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
  }

  input.error {
    border-color: #ff0000;
  }

  .error-text {
    color: #ff0000;
    font-size: 0.875rem;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
```

### 4. Performance Optimizations

#### Lazy Loading Components

```svelte
<script>
  import { onMount } from 'svelte';

  let LazyComponent;
  let showLazy = $state(false);

  async function loadLazyComponent() {
    if (!LazyComponent) {
      const module = await import('./LazyComponent.svelte');
      LazyComponent = module.default;
    }
    showLazy = true;
  }
</script>

<button onclick={loadLazyComponent}>
  Load Lazy Component
</button>

{#if showLazy && LazyComponent}
  <svelte:component this={LazyComponent} />
{/if}
```

#### Memoization with Derived

```svelte
<script>
  let items = $state([]);
  let searchTerm = $state('');

  // Memoized expensive computation
  let expensiveResult = $derived.by(() => {
    console.log('Computing expensive result...');
    return items
      .filter(item => item.name.includes(searchTerm))
      .sort((a, b) => a.score - b.score)
      .slice(0, 10);
  });
</script>
```

### 5. Error Handling

```svelte
<script>
  let data = $state(null);
  let error = $state(null);
  let loading = $state(false);

  async function fetchData() {
    loading = true;
    error = null;

    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      data = await response.json();
    } catch (err) {
      error = err.message;
      console.error('Fetch error:', err);
    } finally {
      loading = false;
    }
  }

  // Auto-fetch on mount
  $effect(() => {
    fetchData();
  });
</script>

{#if loading}
  <div class="loading">Loading...</div>
{:else if error}
  <div class="error">
    <p>Error: {error}</p>
    <button onclick={fetchData}>Retry</button>
  </div>
{:else if data}
  <div class="data">
    <!-- Render data -->
    <pre>{JSON.stringify(data, null, 2)}</pre>
  </div>
{:else}
  <div class="empty">No data available</div>
{/if}
```

### 6. Testing Patterns

```javascript
// Component.test.js
import { render, screen, fireEvent } from "@testing-library/svelte";
import { expect, test } from "vitest";
import Counter from "./Counter.svelte";

test("increments counter when button is clicked", async () => {
  render(Counter, { initialCount: 5 });

  const button = screen.getByRole("button");
  const countDisplay = screen.getByText(/count:/i);

  expect(countDisplay).toHaveTextContent("Count: 5");

  await fireEvent.click(button);

  expect(countDisplay).toHaveTextContent("Count: 6");
});

test("renders with custom props", () => {
  render(Counter, {
    initialCount: 10,
    label: "Custom Counter",
  });

  expect(screen.getByText("Custom Counter")).toBeInTheDocument();
  expect(screen.getByText(/count: 10/i)).toBeInTheDocument();
});
```

## Resources for Further Learning

### Official Documentation

- [Svelte 5.0 Documentation](https://svelte.dev/docs/svelte/overview) - Complete guide to Svelte 5.0
- [Svelte Tutorial](https://learn.svelte.dev/) - Interactive tutorial
- [SvelteKit Documentation](https://kit.svelte.dev/docs) - Full-stack framework built on Svelte
- [Svelte REPL](https://svelte.dev/repl) - Online playground

### Community Resources

- [Svelte Society](https://sveltesociety.dev/) - Community hub with recipes and resources
- [Svelte Discord](https://discord.gg/svelte) - Active community chat
- [r/sveltejs](https://reddit.com/r/sveltejs) - Reddit community
- [Svelte on Stack Overflow](https://stackoverflow.com/questions/tagged/svelte)

### Video Tutorials

- [Svelte Mastery](https://svelte.dev/tutorial) - Official video series
- [Joy of Code](https://joyofcode.xyz/) - Svelte tutorials and best practices
- [Huntabyte](https://www.youtube.com/@Huntabyte) - Advanced Svelte content

### Books and Courses

- "Svelte and SvelteKit" by Josh Nuss
- "The Svelte Handbook" by Flavio Copes
- Svelte courses on Frontend Masters, Udemy, and Pluralsight

### Tools and Ecosystem

- **Development Tools**

  - [Svelte DevTools](https://github.com/sveltejs/svelte-devtools) - Browser extension
  - [Vite](https://vitejs.dev/) - Build tool (recommended)
  - [TypeScript](https://www.typescriptlang.org/) - Type safety

- **UI Libraries**

  - [Shadcn-svelte](https://www.shadcn-svelte.com/) - Modern component library
  - [Svelte Material UI](https://sveltematerialui.com/) - Material Design components
  - [Carbon Components Svelte](https://carbon-components-svelte.onrender.com/) - IBM Carbon Design System

- **State Management**

  - Built-in reactivity with runes
  - [Svelte stores](https://svelte.dev/docs/svelte-store) for global state
  - Context API for component trees

- **Animation Libraries**
  - Built-in transitions and animations
  - [Lottie Svelte](https://github.com/LottieFiles/lottie-svelte) - Lottie animations

### Migration Guides

- [Svelte 4 to 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Runes Migration Guide](https://svelte.dev/docs/svelte/runes)

### Examples and Templates

- [Svelte Examples](https://svelte.dev/examples) - Official examples
- [SvelteKit Examples](https://github.com/sveltejs/kit/tree/master/examples)
- [Svelte Society Templates](https://github.com/svelte-society/svelte-templates)

Start with the official tutorial and documentation, then explore the community resources and build projects to solidify your understanding. The Svelte ecosystem is friendly and welcoming to newcomers!
