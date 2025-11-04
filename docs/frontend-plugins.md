# Frontend Plugin System

## Table of Contents
- [Overview](#overview)
- [Getting Started: Building Your First Plugin](#getting-started-building-your-first-plugin)
  - [1. Prepare the Host Environment](#1-prepare-the-host-environment)
  - [2. Scaffolding a New Plugin Project](#2-scaffolding-a-new-plugin-project)
  - [3. Federation Configuration](#3-federation-configuration)
  - [4. Enabling Type-Sharing for Intellisense](#4-enabling-type-sharing-for-intellisense)
- [Host-Plugin Interaction](#host-plugin-interaction)
  - [Host Exports](#host-exports)
  - [Choosing Shared Dependencies](#choosing-shared-dependencies)
- [Plugin Configuration File](#plugin-configuration-file)
  - [Configuration Structure](#configuration-structure)
  - [Example Configuration](#example-configuration)
  - [Injection Position Examples](#injection-position-examples)
- [Development Workflow](#development-workflow)
  - [1. Run Host and Plugin in Parallel](#1-run-host-and-plugin-in-parallel)
  - [2. Test and Debug](#2-test-and-debug)
  - [3. Best Practices](#3-best-practices)

## Overview

The plugin system allows developers to extend the application's functionality and appearance without modifying the core. It's ideal for teams or third parties to add custom features.

### Glossary
- **Remote**: An application exposing components via module federation.
- **Host**: The main entry point application. This is Docs itself ("impress")
- **Plugin**: A remote module integrated into the host to provide UI components.
- **Module Federation**: Technology for runtime module sharing between apps.

### Features and Limitations
**Features:**
- Add new UI components.
- Reuse host UI components.
- Dynamically inject via CSS selectors and config.
- Integrate without rebuilding or redeploying the host.
- Build and version plugins independently.

**Limitations:**
- Focused on DOM/UI customisations; you cannot add Next.js routes or other server features.
- Runs client-side without direct host state access; shared caches (e.g. React Query) only work when the dependency is also shared as a singleton.
- Host upgrades may require tweaking selectors and matching versions for libraries the host already provides.

## Getting Started: Building Your First Plugin

A plugin is a standalone React application bundled with Webpack that exposes one or more components via Module Federation.

### 1. Prepare the Host Environment

Developing a plugin requires running the host application (Docs) in parallel. This live integration is essential for rendering your plugin, enabling hot-reloading, sharing types for Intellisense, and discovering the exact versions of shared dependencies. The following steps prepare the host environment.

1.  **Clone the repository locally**: If you haven't already, clone the Docs repository to your local machine, and read how to get started with development.
2.  **Set the development flag**: In the host application's `.env.development` file, set `NEXT_PUBLIC_DEVELOP_PLUGINS=true`.
3.  **Stop conflicting services**: If you are using the project's Docker setup, make sure the frontend service is stopped (`docker compose stop frontend-development`) - we will run the docs frontend locally.
4.  **Run the host**: Navigate to `src/frontend/apps/impress`, run `yarn install`, and then `yarn dev`.
5.  **Check the logs**: On startup, the Next.js dev server will print the versions of all shared singletons (e.g., React, styled-components). You will need these for your plugin's `package.json`.

### 2. Scaffolding a New Plugin Project

You will need to create a new, simple React project. Your project should have a `webpack.config.js` and include dependencies for React, Webpack, and TypeScript.

A minimal `package.json` would look like this:
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "scripts": {
    "start": "webpack serve --mode=development",
    "build": "webpack --mode=production"
  },
  "dependencies": {
    "react": "<same as host>",
    "react-dom": "<same as host>",
    "styled-components": "<same as host>",
    "@openfun/cunningham-react": "<same as host>",
    "@tanstack/react-query": "<same as host>"
  },
  "devDependencies": {
    "webpack": "^5.0.0",
    "webpack-cli": "^5.0.0",
    "webpack-dev-server": "^4.0.0",
    "ts-loader": "^9.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@module-federation/native-federation-typescript": "^0.2.1"
  }
}
```

> Replace `<same as host>` with versions from the hosts dev startup log.

### 3. Federation Configuration

The core of the plugin is its Webpack configuration. Here is a sample `webpack.config.js` to get you started.

```javascript
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const { NativeFederationTypeScriptHost } = require('@module-federation/native-federation-typescript/webpack');

const moduleFederationConfig = {
  name: 'my_plugin', // A unique name for your plugin
  filename: 'remoteEntry.js',
  exposes: {
    // Maps a public name to a component file
    './MyCustomComponent': './src/MyCustomComponent.tsx',
  },
  remotes: {
    // Allows importing from the host application
    impress: 'impress@http://localhost:3000/_next/static/chunks/remoteEntry.js',
  },
  shared: {
    // Defines shared libraries to avoid duplication
    react: { singleton: true },
    'react-dom': { singleton: true },
    'styled-components': { singleton: true },
    '@openfun/cunningham-react': { singleton: true },
    '@tanstack/react-query': { singleton: true },
  },
};

module.exports = (env, argv) => {
  const dev = argv.mode !== 'production';

  return {
    devServer: {
      // The port should match the one in your plugin's configuration file
      port: 8080,
    },
    entry: './src/index.tsx', // Your plugin's entry point; can be an empty file as modules are exposed directly.
    plugins: [
      new ModuleFederationPlugin(moduleFederationConfig),
      // This plugin enables type-sharing for intellisense
      ...(dev ? [NativeFederationTypeScriptHost({ moduleFederationConfig })] : []),
    ],
    // ... other webpack config (output, module rules, etc.)
  };
};
```

### 4. Enabling Type-Sharing for Intellisense

To get autocompletion for components and hooks exposed by the host, you need to configure your plugin's `tsconfig.json` to find the host's types.

In your plugin's `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "*": ["./@mf-types/*"]
    }
  }
}
```
When you run the host application with `NEXT_PUBLIC_DEVELOP_PLUGINS=true`, it generates a `@mf-types.zip` file. The `NativeFederationTypeScriptHost` plugin in your webpack config will automatically download and unpack it, making the host's types available to your plugin (and IDE).

## Host-Plugin Interaction

### Host Exports
The host automatically exposes many of its components and hooks. You can import them in your plugin as if they were local modules, thanks to the `remotes` configuration in your `webpack.config.js`.

```typescript
// In your plugin's code
import { Icon } from 'impress/components';
import { useAuthQuery } from 'impress/features/auth/api';
```

### Choosing Shared Dependencies

Sharing dependencies is critical for performance and stability.
-   **Minimal Shared Libraries**: Always share `react`, `react-dom`, `styled-components`, and `@openfun/cunningham-react` to use the same instances as the host.
-   **Sharing State**: Libraries that rely on a global context (like `@tanstack/react-query`) **must** be shared to access the host's state and cache.
-   **Discovering More Shared Libraries**: With `NEXT_PUBLIC_DEVELOP_PLUGINS=true`, the host prints its shared dependency map to the Next.js dev server logs on startup. You can use this to align versions and add more shared libraries to your plugin.

> **Important**: Both the host and the plugin must declare a dependency in their `shared` configuration for it to become a true singleton. If you omit a shared dependency from your plugin's config, Webpack will bundle a separate copy into your plugin, breaking the singleton pattern.

## Plugin Configuration File

Once your plugin is running, you need to tell the host application how to load and inject it. This is done via a JSON configuration file loaded by the host at runtime from the backend.

The default path for this file in the backend container is `/app/impress/configuration/plugins/default.json`.
> When running Docs locally the backend is bind-mapped to the container, so you can simply live edit `src/backend/impress/configuration/plugins/default.json`

> When running in production you can replace this file through infrastructure methods. e.g. k8s configmap.

### Configuration Structure

| Field       | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `id`       | String | Yes     | Unique component identifier (e.g., "my-widget"). |
| `remote`   | Object | Yes     | Remote module details. |
|   - `url`  | String | Yes     | Path to `remoteEntry.js` (absolute/relative). |
|   - `name` | String | Yes     | Federation remote name (e.g., "myPlugin"). |
|   - `module` | String | Yes   | Exposed module (e.g., "./Widget"). |
| `injection`| Object | Yes     | Integration control. |
|   - `target` | String | Yes     | CSS selector for insertion point. |
|   - `position` | String | No (default: "append") | Insertion position (`before`, `after`, `replace`, `prepend`, `append`). |
|   - `observerRoots` | String/Boolean | No | DOM observation: CSS selector, `true` (observe whole document), or `false` (default; disable observers). |
| `props`    | Object | No      | Props passed to the plugin component. |
| `visibility` | Object | No    | Visibility controls. |
|   - `routes` | Array  | No     | Path globs (e.g., `["/docs/*", "!/docs/secret*"]`); supports `*` and `?` wildcards plus negation (`!`). |

### Example Configuration

This JSON tells the host to load `MyCustomComponent` from your plugin's `remoteEntry.js` and inject it into the DOM.

```json
{
  "id": "my-custom-component",
  "remote": {
    "url": "http://localhost:8080/remoteEntry.js",
    "name": "my_plugin",
    "module": "./MyCustomComponent"
  },
  "injection": {
    "target": "#some-element-in-the-host"
  }
}
```
> For production, it is recommended to use a relative `url` by placing the plugin's `remoteEntry.js` inside the host's public folder. This simplifies deployment by serving both the host and plugins from the same origin, which avoids the need to configure Cross-Origin Resource Sharing (CORS) policies.

### Injection Position Examples

The `injection.position` property controls how your plugin is inserted relative to the `target` element.

<details>
<summary>View injection examples</summary>

**before**
```json
{
  "id": "my-custom-component-0",
  "injection": {
    "target": "#item2",
    "position": "before"
  }
}
```
```html
<ul id="some-element-in-the-host">
  <li id="item1"></li>
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item2"></li>
</ul>
```

**after**
```json
{
  "id": "my-custom-component-0",
  "injection": {
    "target": "#item1",
    "position": "after"
  }
}
```
```html
<ul id="some-element-in-the-host">
  <li id="item1"></li>
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item2"></li>
</ul>
```

**prepend**
```json
{
  "id": "my-custom-component-0",
  "injection": {
    "target": "#some-element-in-the-host",
    "position": "prepend"
  }
}
```
```html
<ul id="some-element-in-the-host">
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item1"></li>
  <li id="item2"></li>
</ul>
```

**append** (default)
```json
{
  "id": "my-custom-component-0",
  "injection": {
    "target": "#some-element-in-the-host",
    "position": "append"
  }
}
```
```html
<ul id="some-element-in-the-host">
  <li id="item1"></li>
  <li id="item2"></li>
  <div id="plugin-container-my-custom-component-0"></div>
</ul>
```

**replace**
```json
{
  "id": "my-custom-component-0",
  "injection": {
    "target": "#item1",
    "position": "replace"
  }
}
```
```html
<ul id="some-element-in-the-host">
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item1" data-pluginsystem-hidden="true"></li>
  <li id="item2"></li>
</ul>
```
</details>

## Development Workflow

### 1. Run Host and Plugin in Parallel
Enable `NEXT_PUBLIC_DEVELOP_PLUGINS=true` in the host's `.env.development` file. Start both the host and your plugin's dev servers. This enables hot-reloading and live type-sharing.

### 2. Test and Debug
- Use the `[PluginSystem]` logs in the browser console to see if your plugin is loading correctly.
- Errors in your plugin are caught by an `ErrorBoundary` and will not crash the host.

Common Errors:
| Issue                  | Cause/Fix |
|------------------------|-----------|
| Unreachable `remoteEntry.js` | Check the `url` in your config JSON. |
| Library version conflicts | Ensure `shared` library versions in your `package.json` match the host's. |
| Invalid CSS selectors | Validate the `target` selector against the host's DOM. |

### 3. Best Practices
- Build modular components with well-typed props.
- Prefer using the host's exposed types and components over implementing your own.
- Keep shared dependency versions aligned with the host and re-test after host upgrades.
- Treat plugin bundles as untrusted: vet dependencies and avoid unsafe scripts.
