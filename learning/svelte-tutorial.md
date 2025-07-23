# Svelte Tutorial

## Introduction to Svelte

### What is Svelte?

Svelte is a modern JavaScript framework for building user interfaces. Unlike traditional frameworks like React or Vue, Svelte shifts much of the work from runtime to compile time. This means that instead of shipping the framework code to the browser and interpreting your application at runtime, Svelte compiles your code into highly efficient vanilla JavaScript during the build process.

### Core Philosophy

Svelte's core philosophy centers around three main principles:

1. **Write less code**: Svelte's syntax is designed to be concise and intuitive, reducing boilerplate and allowing developers to express their ideas with minimal code.

2. **No virtual DOM**: Instead of using a virtual DOM diffing algorithm like React or Vue, Svelte compiles your components into code that surgically updates the DOM when your application state changes.

3. **Truly reactive**: Svelte's reactivity is built into the language itself rather than being based on proxies or getters/setters, making it more intuitive and efficient.

## How Svelte Differs from Other Frameworks

### Svelte vs. React

| Feature | Svelte | React |
|---------|--------|-------|
| **Rendering approach** | Compile-time | Runtime with Virtual DOM |
| **Bundle size** | Smaller (no framework code) | Larger (includes React runtime) |
| **State management** | Built-in reactivity | Requires useState/useReducer hooks |
| **Learning curve** | Gentle, similar to HTML/CSS/JS | Steeper, requires JSX understanding |
| **Performance** | Excellent for small to medium apps | Good, but with overhead for small apps |
| **Community & ecosystem** | Growing, but smaller | Very large and mature |

### Svelte vs. Vue

| Feature | Svelte | Vue |
|---------|--------|-----|
| **Rendering approach** | Compile-time | Runtime with Virtual DOM |
| **Template syntax** | HTML-based with minimal extensions | HTML-based with directives |
| **Reactivity** | Compile-time assignments | Proxy-based reactivity system |
| **Component structure** | Single file components | Single file components |
| **Learning curve** | Gentle, similar to HTML/CSS/JS | Moderate, intuitive API |
| **Performance** | Excellent for small to medium apps | Good, optimized virtual DOM |

## Installation and Project Setup

### Prerequisites

Before getting started with Svelte, ensure you have:

- Node.js (version 16 or later recommended)
- npm or another package manager (like pnpm or yarn)

### Creating a New Svelte Project

The easiest way to create a new Svelte project is using the official template:

```bash
# Using npm
npm create svelte@latest my-svelte-app

# Using pnpm
pnpm create svelte@latest my-svelte-app

# Using yarn
yarn create svelte my-svelte-app
```

This will prompt you with several options:

1. Choose a template (Skeleton project, Demo app, Library template)
2. Add TypeScript support (optional)
3. Add ESLint for code linting (optional)
4. Add Prettier for code formatting (optional)
5. Add Playwright for browser testing (optional)
6. Add Vitest for unit testing (optional)

After creating the project, navigate to the project directory and install dependencies:

```bash
cd my-svelte-app
npm install
```

### Project Structure

A typical Svelte project structure looks like this:

```
my-svelte-app/
├── node_modules/
├── public/
│   ├── favicon.png
│   └── index.html
├── src/
│   ├── lib/
│   │   └── Counter.svelte
│   ├── routes/
│   │   └── +page.svelte
│   ├── app.html
│   └── app.d.ts
├── static/
├── .gitignore
├── package.json
├── svelte.config.js
├── tsconfig.json (if using TypeScript)
└── vite.config.js
```

### Running the Development Server

To start the development server:

```bash
npm run dev
```

This will start a local development server, typically at `http://localhost:5173`.

## Basic Syntax and Reactivity Model

### Component Structure

A Svelte component is a `.svelte` file that contains three sections:

1. **Script**: JavaScript code that defines the component's behavior
2. **Style**: CSS that styles the component
3. **Template**: HTML that defines the component's structure

Here's a basic example:

```svelte
<script>
  // JavaScript goes here
  let name = 'world';
</script>

<style>
  /* CSS goes here */
  h1 {
    color: purple;
  }
</style>

<!-- HTML goes here -->
<h1>Hello {name}!</h1>
```

### Reactivity

Svelte's reactivity system is based on assignments. When you assign a new value to a variable that's used in your template, Svelte automatically updates the DOM.

```svelte
<script>
  let count = 0;
  
  function increment() {
    count += 1;  // This assignment triggers a DOM update
  }
</script>

<button on:click={increment}>
  Clicked {count} {count === 1 ? 'time' : 'times'}
</button>
```

### Reactive Declarations

You can create variables that depend on other variables using the `$:` syntax:

```svelte
<script>
  let count = 0;
  $: doubled = count * 2;
  
  // You can also run arbitrary statements reactively
  $: if (count >= 10) {
    alert('Count is now 10!');
  }
</script>

<button on:click={() => count++}>
  Count: {count}
</button>

<p>Doubled: {doubled}</p>
```

### Reactive Statements

Reactive statements run whenever their dependencies change:

```svelte
<script>
  let firstName = 'John';
  let lastName = 'Doe';
  
  $: fullName = `${firstName} ${lastName}`;
  
  // This will run whenever firstName or lastName changes
  $: console.log(`Name changed to ${fullName}`);
</script>

<input bind:value={firstName}>
<input bind:value={lastName}>

<p>Full name: {fullName}</p>
```

## Components, Props, and State Management

### Creating Components

Components in Svelte are reusable UI elements. Each component is defined in its own `.svelte` file:

```svelte
<!-- Button.svelte -->
<script>
  export let text = 'Click me';  // Default value
</script>

<button>
  {text}
</button>
```

### Using Props

Props are passed to components as attributes:

```svelte
<script>
  import Button from './Button.svelte';
</script>

<Button text="Submit" />
<Button text="Cancel" />
```

### Default Props

You can provide default values for props:

```svelte
<script>
  export let name = 'world';
  export let color = 'blue';
</script>

<p style="color: {color}">Hello {name}!</p>
```

### Spreading Props

You can spread an object of props:

```svelte
<script>
  import Info from './Info.svelte';
  
  const pkg = {
    name: 'svelte',
    version: 4,
    speed: 'blazing',
    website: 'https://svelte.dev'
  };
</script>

<Info {...pkg} />
```

### State Management

For simple applications, local component state is often sufficient:

```svelte
<script>
  let count = 0;
  
  function increment() {
    count += 1;
  }
  
  function reset() {
    count = 0;
  }
</script>

<button on:click={increment}>Increment</button>
<button on:click={reset}>Reset</button>
<p>Count: {count}</p>
```

### Stores for Global State

For sharing state between components, Svelte provides stores:

```svelte
<!-- stores.js -->
import { writable } from 'svelte/store';

export const count = writable(0);
```

```svelte
<!-- Counter.svelte -->
<script>
  import { count } from './stores.js';
  
  function increment() {
    $count += 1;  // The $ prefix automatically subscribes to the store
  }
</script>

<button on:click={increment}>
  Count: {$count}
</button>
```

There are three types of stores in Svelte:

1. **Writable stores**: Can be both read from and written to
2. **Readable stores**: Can only be read, not written to
3. **Derived stores**: Values derived from other stores

```svelte
<script>
  import { writable, readable, derived } from 'svelte/store';
  
  const count = writable(0);
  const time = readable(new Date(), set => {
    const interval = setInterval(() => {
      set(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  });
  
  const elapsed = derived(
    time,
    $time => Math.round(($time - start) / 1000)
  );
</script>
```

## Lifecycle Methods

Svelte components have several lifecycle methods that allow you to run code at specific times:

### onMount

Runs after the component is first rendered to the DOM:

```svelte
<script>
  import { onMount } from 'svelte';
  
  let data = [];
  
  onMount(async () => {
    const response = await fetch('https://api.example.com/data');
    data = await response.json();
  });
</script>
```

### onDestroy

Runs when the component is removed from the DOM:

```svelte
<script>
  import { onDestroy } from 'svelte';
  
  const interval = setInterval(() => {
    console.log('Tick');
  }, 1000);
  
  onDestroy(() => {
    clearInterval(interval);
  });
</script>
```

### beforeUpdate and afterUpdate

Run before and after the DOM is updated:

```svelte
<script>
  import { beforeUpdate, afterUpdate } from 'svelte';
  
  let count = 0;
  
  beforeUpdate(() => {
    console.log('Component is about to update');
  });
  
  afterUpdate(() => {
    console.log('Component just updated');
  });
</script>

<button on:click={() => count++}>
  Update ({count})
</button>
```

### tick

A function that returns a promise that resolves after the next DOM update:

```svelte
<script>
  import { tick } from 'svelte';
  
  let textArea;
  
  async function handleKeydown(event) {
    if (event.key === 'Tab') {
      event.preventDefault();
      
      const { selectionStart, selectionEnd, value } = textArea;
      const newValue = value.slice(0, selectionStart) + '\t' + value.slice(selectionEnd);
      
      textArea.value = newValue;
      
      // Wait for the DOM to update
      await tick();
      
      // Set the cursor position after the tab
      textArea.selectionStart = textArea.selectionEnd = selectionStart + 1;
    }
  }
</script>

<textarea bind:this={textArea} on:keydown={handleKeydown}></textarea>
```

## Event Handling and Binding

### Event Handling

Svelte uses the `on:` directive to handle DOM events:

```svelte
<script>
  let count = 0;
  
  function handleClick() {
    count += 1;
  }
</script>

<button on:click={handleClick}>
  Clicked {count} {count === 1 ? 'time' : 'times'}
</button>
```

### Inline Event Handlers

You can also use inline functions:

```svelte
<button on:click={() => count += 1}>
  Increment
</button>
```

### Event Modifiers

Svelte provides event modifiers to control how events are handled:

```svelte
<!-- Prevents default behavior -->
<form on:submit|preventDefault={handleSubmit}>
  <!-- Form content -->
</form>

<!-- Only triggers once -->
<button on:click|once={handleClick}>Click me</button>

<!-- Stops propagation -->
<div on:click={handleOuterClick}>
  <button on:click|stopPropagation={handleInnerClick}>Click me</button>
</div>

<!-- Captures the event during the capture phase -->
<div on:click|capture={handleCapture}>
  <button on:click={handleClick}>Click me</button>
</div>

<!-- Only triggers if event.target is the element itself -->
<div on:click|self={handleSelfClick}>
  <button>This won't trigger the div's click handler</button>
</div>

<!-- Passive event listener (improves scrolling performance) -->
<div on:scroll|passive={handleScroll}>
  <!-- Content -->
</div>
```

### Component Events

Components can dispatch custom events:

```svelte
<!-- Button.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  function handleClick() {
    dispatch('click', {
      text: 'Button was clicked'
    });
  }
</script>

<button on:click={handleClick}>
  <slot></slot>
</button>
```

```svelte
<!-- App.svelte -->
<script>
  import Button from './Button.svelte';
  
  function handleButtonClick(event) {
    console.log(event.detail.text);  // "Button was clicked"
  }
</script>

<Button on:click={handleButtonClick}>
  Click me
</Button>
```

### Event Forwarding

Components can forward events from their children:

```svelte
<!-- Button.svelte -->
<button on:click>
  <slot></slot>
</button>
```

```svelte
<!-- App.svelte -->
<script>
  import Button from './Button.svelte';
  
  function handleClick() {
    console.log('Button was clicked');
  }
</script>

<Button on:click={handleClick}>
  Click me
</Button>
```

### Two-Way Binding

Svelte provides the `bind:` directive for two-way data binding:

```svelte
<script>
  let name = '';
  let email = '';
  let selection = '';
  let checked = false;
</script>

<!-- Text input -->
<input bind:value={name}>

<!-- Email input -->
<input type="email" bind:value={email}>

<!-- Checkbox -->
<input type="checkbox" bind:checked={checked}>

<!-- Select -->
<select bind:value={selection}>
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
</select>
```

### Binding to Component Props

You can also bind to component props:

```svelte
<!-- Counter.svelte -->
<script>
  export let count = 0;
</script>

<button on:click={() => count += 1}>
  {count}
</button>
```

```svelte
<!-- App.svelte -->
<script>
  import Counter from './Counter.svelte';
  
  let count = 0;
</script>

<Counter bind:count />

<p>The count is {count}</p>
```

## Animations and Transitions

Svelte provides built-in transition and animation directives that make it easy to add motion to your UI.

### Transitions

Transitions are applied when elements are added to or removed from the DOM:

```svelte
<script>
  import { fade, fly, slide, scale } from 'svelte/transition';
  
  let visible = true;
</script>

<button on:click={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <p transition:fade>Fades in and out</p>
  <p transition:fly={{ y: 200, duration: 2000 }}>Flies in and out</p>
  <p transition:slide>Slides in and out</p>
  <p transition:scale>Scales in and out</p>
{/if}
```

### In and Out Transitions

You can specify different transitions for entering and leaving:

```svelte
<script>
  import { fade, fly } from 'svelte/transition';
  
  let visible = true;
</script>

<button on:click={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <p in:fly={{ y: 200 }} out:fade>
    Flies in, fades out
  </p>
{/if}
```

### Transition Parameters

Most transitions accept parameters to customize their behavior:

```svelte
<script>
  import { fly } from 'svelte/transition';
  
  let visible = true;
</script>

{#if visible}
  <p transition:fly={{ 
    y: 200,          // Vertical distance
    x: 0,            // Horizontal distance
    duration: 2000,  // Duration in ms
    delay: 500,      // Delay before starting
    easing: cubicOut // Easing function
  }}>
    Customized fly transition
  </p>
{/if}
```

### Custom Transitions

You can create custom transitions:

```svelte
<script>
  function typewriter(node, { speed = 1 }) {
    const text = node.textContent;
    const duration = text.length / (speed * 0.01);
    
    return {
      duration,
      tick: t => {
        const i = Math.floor(text.length * t);
        node.textContent = text.slice(0, i);
      }
    };
  }
  
  let visible = true;
</script>

<button on:click={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <p transition:typewriter={{ speed: 1 }}>
    This text will be typed out character by character
  </p>
{/if}
```

### Animations

Animations are used to animate between different values:

```svelte
<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  
  const progress = tweened(0, {
    duration: 400,
    easing: cubicOut
  });
</script>

<button on:click={() => progress.set(0)}>
  Reset
</button>

<button on:click={() => progress.set(1)}>
  Complete
</button>

<progress value={$progress}></progress>
```

### Spring Animations

Spring animations are physics-based and can feel more natural:

```svelte
<script>
  import { spring } from 'svelte/motion';
  
  const coords = spring({ x: 0, y: 0 }, {
    stiffness: 0.1,
    damping: 0.25
  });
  
  function handleMousemove(event) {
    coords.set({ x: event.clientX, y: event.clientY });
  }
</script>

<div on:mousemove={handleMousemove}>
  <div style="position: absolute; left: {$coords.x}px; top: {$coords.y}px;">
    🔴
  </div>
</div>
```

### Flip Animations

The `flip` function creates smooth animations between different states:

```svelte
<script>
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  
  let list = [1, 2, 3, 4, 5];
  
  function shuffle() {
    list = list.sort(() => Math.random() - 0.5);
  }
</script>

<button on:click={shuffle}>
  Shuffle
</button>

<div>
  {#each list as item (item)}
    <div animate:flip={{ duration: 500, easing: quintOut }}>
      {item}
    </div>
  {/each}
</div>
```

## Best Practices and Common Patterns

### Component Organization

1. **Single Responsibility**: Each component should do one thing well
2. **Logical Folder Structure**: Organize components by feature or type
3. **Consistent Naming**: Use consistent naming conventions (e.g., PascalCase for components)

Example folder structure:

```
src/
├── lib/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.svelte
│   │   │   ├── Input.svelte
│   │   │   └── Modal.svelte
│   │   ├── layout/
│   │   │   ├── Header.svelte
│   │   │   ├── Footer.svelte
│   │   │   └── Sidebar.svelte
│   │   └── features/
│   │       ├── auth/
│   │       │   ├── LoginForm.svelte
│   │       │   └── SignupForm.svelte
│   │       └── dashboard/
│   │           ├── Chart.svelte
│   │           └── Stats.svelte
│   ├── stores/
│   │   ├── auth.js
│   │   └── theme.js
│   └── utils/
│       ├── api.js
│       └── formatters.js
└── routes/
    ├── +layout.svelte
    ├── +page.svelte
    ├── about/+page.svelte
    └── dashboard/+page.svelte
```

### Props Validation

While Svelte doesn't have built-in props validation like PropTypes in React, you can implement your own validation:

```svelte
<script>
  export let name;
  export let age;
  
  // Validate props
  $: if (typeof name !== 'string') {
    throw new Error('name must be a string');
  }
  
  $: if (typeof age !== 'number' || age < 0) {
    throw new Error('age must be a positive number');
  }
</script>
```

### Slot Patterns

Use slots to create flexible, reusable components:

```svelte
<!-- Card.svelte -->
<div class="card">
  <div class="card-header">
    <slot name="header">
      <!-- Default content if no header is provided -->
      <h2>Default Header</h2>
    </slot>
  </div>
  
  <div class="card-body">
    <slot>
      <!-- Default content -->
      <p>Default content</p>
    </slot>
  </div>
  
  <div class="card-footer">
    <slot name="footer">
      <!-- Default footer -->
      <button>Close</button>
    </slot>
  </div>
</div>
```

```svelte
<!-- Usage -->
<Card>
  <h2 slot="header">Custom Header</h2>
  <p>This is the main content</p>
  <div slot="footer">
    <button>Save</button>
    <button>Cancel</button>
  </div>
</Card>
```

### Context API

Use the context API to share data between components without props drilling:

```svelte
<!-- Parent.svelte -->
<script>
  import { setContext } from 'svelte';
  import Child from './Child.svelte';
  
  const theme = {
    primary: '#ff3e00',
    secondary: '#676778'
  };
  
  setContext('theme', theme);
</script>

<Child />
```

```svelte
<!-- Child.svelte -->
<script>
  import { getContext } from 'svelte';
  
  const theme = getContext('theme');
</script>

<div style="color: {theme.primary}">
  Themed content
</div>
```

### Action Functions

Actions are functions that run when an element is created and can return an object with lifecycle methods:

```svelte
<script>
  function tooltip(node, text) {
    const tooltip = document.createElement('div');
    tooltip.textContent = text;
    tooltip.style.position = 'absolute';
    tooltip.style.display = 'none';
    
    function position() {
      const { top, left, width } = node.getBoundingClientRect();
      tooltip.style.top = `${top - tooltip.offsetHeight}px`;
      tooltip.style.left = `${left + width / 2 - tooltip.offsetWidth / 2}px`;
    }
    
    function show() {
      document.body.appendChild(tooltip);
      tooltip.style.display = 'block';
      position();
    }
    
    function hide() {
      tooltip.style.display = 'none';
      tooltip.remove();
    }
    
    node.addEventListener('mouseenter', show);
    node.addEventListener('mouseleave', hide);
    
    return {
      update(newText) {
        tooltip.textContent = newText;
      },
      destroy() {
        node.removeEventListener('mouseenter', show);
        node.removeEventListener('mouseleave', hide);
        tooltip.remove();
      }
    };
  }
</script>

<button use:tooltip={'Click me!'}>
  Hover for tooltip
</button>
```

### Reactive Stores Pattern

For complex applications, organize stores by feature:

```js
// stores/auth.js
import { writable, derived } from 'svelte/store';

// Create the base store
const user = writable(null);

// Create derived stores
const isAuthenticated = derived(user, $user => $user !== null);
const username = derived(user, $user => $user?.username || 'Guest');

// Create store actions
function login(credentials) {
  // Authenticate user
  return fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  })
    .then(res => res.json())
    .then(userData => {
      user.set(userData);
      return userData;
    });
}

function logout() {
  user.set(null);
  return fetch('/api/logout');
}

// Export everything
export {
  user,
  isAuthenticated,
  username,
  login,
  logout
};
```

```svelte
<!-- Usage -->
<script>
  import { isAuthenticated, username, logout } from './stores/auth';
</script>

{#if $isAuthenticated}
  <p>Welcome, {$username}!</p>
  <button on:click={logout}>Logout</button>
{:else}
  <p>Please log in</p>
{/if}
```

### Error Handling

Implement error boundaries to catch and handle errors:

```svelte
<!-- ErrorBoundary.svelte -->
<script>
  import { onError } from 'svelte';
  
  let error = null;
  
  onError(({ error: e }) => {
    error = e;
  });
</script>

{#if error}
  <div class="error">
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button on:click={() => error = null}>Try again</button>
  </div>
{:else}
  <slot />
{/if}
```

```svelte
<!-- Usage -->
<ErrorBoundary>
  <ComponentThatMightError />
</ErrorBoundary>
```

## Code Examples

### Counter Component

```svelte
<!-- Counter.svelte -->
<script>
  export let initialCount = 0;
  
  let count = initialCount;
  
  function increment() {
    count += 1;
  }
  
  function decrement() {
    count -= 1;
  }
  
  function reset() {
    count = initialCount;
  }
</script>

<div class="counter">
  <button on:click={decrement}>-</button>
  <span>{count}</span>
  <button on:click={increment}>+</button>
  <button on:click={reset}>Reset</button>
</div>

<style>
  .counter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  button {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f9f9f9;
    cursor: pointer;
  }
  
  span {
    min-width: 2rem;
    text-align: center;
  }
</style>
```

### Todo List

```svelte
<!-- TodoList.svelte -->
<script>
  let newTodo = '';
  let todos = [];
  
  function addTodo() {
    if (newTodo.trim()) {
      todos = [...todos, { id: Date.now(), text: newTodo, completed: false }];
      newTodo = '';
    }
  }
  
  function toggleTodo(id) {
    todos = todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
  }
  
  function removeTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
  }
  
  $: remaining = todos.filter(todo => !todo.completed).length;
</script>

<div class="todo-list">
  <h2>Todo List</h2>
  
  <form on:submit|preventDefault={addTodo}>
    <input bind:value={newTodo} placeholder="Add a new todo">
    <button type="submit">Add</button>
  </form>
  
  <p>{remaining} of {todos.length} items remaining</p>
  
  <ul>
    {#each todos as todo (todo.id)}
      <li class:completed={todo.completed}>
        <input 
          type="checkbox" 
          checked={todo.completed} 
          on:change={() => toggleTodo(todo.id)}
        >
        <span>{todo.text}</span>
        <button on:click={() => removeTodo(todo.id)}>❌</button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .todo-list {
    max-width: 500px;
    margin: 0 auto;
  }
  
  form {
    display: flex;
    margin-bottom: 1rem;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px 0 0 4px;
  }
  
  form button {
    padding: 0.5rem 1rem;
    background: #0366d6;
    color: white;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
  }
  
  ul {
    list-style: none;
    padding: 0;
  }
  
  li {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
  }
  
  li.completed span {
    text-decoration: line-through;
    color: #999;
  }
  
  li span {
    flex: 1;
    margin: 0 0.5rem;
  }
  
  li button {
    background: none;
    border: none;
    cursor: pointer;
  }
</style>
```

### Fetch Data Example

```svelte
<!-- FetchData.svelte -->
<script>
  import { onMount } from 'svelte';
  
  let posts = [];
  let loading = true;
  let error = null;
  
  onMount(async () => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts');
      if (!response.ok) throw new Error('Failed to fetch data');
      posts = await response.json();
    } catch (e) {
      error = e;
    } finally {
      loading = false;
    }
  });
</script>

<div>
  <h2>Posts</h2>
  
  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error.message}</p>
  {:else}
    <ul>
      {#each posts as post (post.id)}
        <li>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  ul {
    list-style: none;
    padding: 0;
  }
  
  li {
    margin-bottom: 1rem;
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 4px;
  }
  
  .error {
    color: red;
  }
</style>
```

### Form Handling

```svelte
<!-- Form.svelte -->
<script>
  let formData = {
    name: '',
    email: '',
    message: '',
    subscribe: false
  };
  
  let errors = {};
  let submitted = false;
  
  function validate() {
    errors = {};
    
    if (!formData.name) {
      errors.name = 'Name is required';
    }
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!formData.message) {
      errors.message = 'Message is required';
    }
    
    return Object.keys(errors).length === 0;
  }
  
  function handleSubmit() {
    if (validate()) {
      // Submit the form
      console.log('Form submitted:', formData);
      submitted = true;
    }
  }
</script>

<div class="form-container">
  {#if submitted}
    <div class="success">
      <h2>Thank you!</h2>
      <p>Your message has been submitted successfully.</p>
      <button on:click={() => submitted = false}>Send another message</button>
    </div>
  {:else}
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="name">Name</label>
        <input 
          id="name" 
          type="text" 
          bind:value={formData.name} 
          class:error={errors.name}
        >
        {#if errors.name}
          <span class="error-message">{errors.name}</span>
        {/if}
      </div>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input 
          id="email" 
          type="email" 
          bind:value={formData.email} 
          class:error={errors.email}
        >
        {#if errors.email}
          <span class="error-message">{errors.email}</span>
        {/if}
      </div>
      
      <div class="form-group">
        <label for="message">Message</label>
        <textarea 
          id="message" 
          bind:value={formData.message} 
          class:error={errors.message}
        ></textarea>
        {#if errors.message}
          <span class="error-message">{errors.message}</span>
        {/if}
      </div>
      
      <div class="form-group checkbox">
        <input 
          id="subscribe" 
          type="checkbox" 
          bind:checked={formData.subscribe}
        >
        <label for="subscribe">Subscribe to newsletter</label>
      </div>
      
      <button type="submit">Submit</button>
    </form>
  {/if}
</div>

<style>
  .form-container {
    max-width: 500px;
    margin: 0 auto;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
  }
  
  input, textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  input.error, textarea.error {
    border-color: red;
  }
  
  .error-message {
    color: red;
    font-size: 0.8rem;
  }
  
  .checkbox {
    display: flex;
    align-items: center;
  }
  
  .checkbox input {
    width: auto;
    margin-right: 0.5rem;
  }
  
  .checkbox label {
    margin: 0;
  }
  
  button {
    padding: 0.5rem 1rem;
    background: #0366d6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .success {
    text-align: center;
    padding: 2rem;
    background: #f0fff0;
    border: 1px solid #d0f0d0;
    border-radius: 4px;
  }
</style>
```

## Resources for Further Learning

### Official Resources

- [Svelte Website](https://svelte.dev/) - Official website with documentation, tutorials, and examples
- [Svelte Tutorial](https://svelte.dev/tutorial) - Interactive tutorial covering all Svelte concepts
- [Svelte Examples](https://svelte.dev/examples) - Collection of small examples demonstrating Svelte features
- [Svelte REPL](https://svelte.dev/repl) - Online playground for experimenting with Svelte
- [Svelte GitHub Repository](https://github.com/sveltejs/svelte) - Source code and issue tracker

### Community Resources

- [Svelte Society](https://sveltesociety.dev/) - Community-driven collection of Svelte resources
- [Made with Svelte](https://madewithsvelte.com/) - Showcase of projects built with Svelte
- [Svelte Discord](https://discord.gg/svelte) - Official Svelte Discord community
- [Svelte Reddit](https://www.reddit.com/r/sveltejs/) - Svelte subreddit

### Books and Courses

- [Svelte.js - The Complete Guide](https://www.udemy.com/course/sveltejs-the-complete-guide/) - Comprehensive Udemy course
- [Svelte for Beginners](https://www.youtube.com/playlist?list=PL4cUxeGkcC9hlbrVO_2QFVqVPhlZmz7tO) - Free YouTube tutorial series
- [Svelte Handbook](https://www.freecodecamp.org/news/the-svelte-handbook/) - Free comprehensive guide on freeCodeCamp

### Tools and Libraries

- [SvelteKit](https://kit.svelte.dev/) - Official framework for building Svelte applications
- [Svelte-Query](https://sveltequery.vercel.app/) - Data fetching library for Svelte
- [Svelte-Forms-Lib](https://github.com/tjinauyeung/svelte-forms-lib) - Form validation library
- [Svelte-Transition](https://github.com/sveltejs/svelte-transitions) - Additional transitions for Svelte
- [Svelte-Preprocess](https://github.com/sveltejs/svelte-preprocess) - Preprocessor for Svelte components

### Advanced Topics

- [State Management in Svelte](https://www.youtube.com/watch?v=S1vR2uUiQWk) - Deep dive into Svelte's state management
- [Svelte and TypeScript](https://svelte.dev/blog/svelte-and-typescript) - Official guide on using TypeScript with Svelte
- [Svelte Accessibility (A11y)](https://github.com/sveltejs/svelte-a11y) - Accessibility guidelines for Svelte
- [Testing Svelte Components](https://testing-library.com/docs/svelte-testing-library/intro/) - Guide on testing Svelte components
- [Server-Side Rendering with Svelte](https://svelte.dev/blog/sapper-towards-the-ideal-web-app-framework) - Introduction to SSR in Svelte

By following this tutorial and exploring these resources, you'll be well-equipped to build modern, efficient web applications with Svelte. Happy coding!