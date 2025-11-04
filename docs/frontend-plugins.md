# Frontend Plugin System

## Table of Contents
- [Overview](#overview "Go to Overview section")
- [Getting Started: Building Your First Plugin](#getting-started-building-your-first-plugin "Go to the Getting Started guide")
  - [1. Prepare the Host Environment](#1-prepare-the-host-environment "Step 1: Prepare the host")
  - [2. Scaffolding a New Plugin Project](#2-scaffolding-a-new-plugin-project "Step 2: Scaffold the plugin")
  - [3. Creating a Plugin Component](#3-creating-a-plugin-component "Step 3: Create the React component")
  - [4. Federation Configuration](#4-federation-configuration "Step 4: Configure module federation")
  - [5. Enabling Type-Sharing for Intellisense](#5-enabling-type-sharing-for-intellisense "Step 5: Enable type-sharing")
  - [6. Running and Configuring Your Plugin](#6-running-and-configuring-your-plugin "Step 6: Run and configure")
- [Host-Plugin Interaction](#host-plugin-interaction "How the host and plugin interact")
  - [Host Exports](#host-exports "What the host exports")
  - [Choosing Shared Dependencies](#choosing-shared-dependencies "Learn about shared dependencies")
- [Development Workflow](#development-workflow "Go to Development Workflow section")
  - [Test and Debug](#test-and-debug "How to test and debug")
  - [Best Practices](#best-practices "View best practices")
- [Plugin Configuration File Reference](#plugin-configuration-file-reference "Go to the Configuration File reference")
  - [Configuration Structure](#configuration-structure "See the config file structure")
  - [Injection Position Examples](#injection-position-examples "See examples of injection positions")
- [Releasing a Plugin](#releasing-a-plugin "How to release a plugin")
- [Deploying Docs with Plugins](#deploying-docs-with-plugins "How to deploy plugins in production")

## Overview

The plugin system allows developers to extend the application's functionality and appearance without modifying the core.  
It's ideal for teams or third parties to add custom features.

<br>

### Glossary
-   **Remote**: An application exposing components via module federation.
-   **Host**: The main entry point application. This is Docs itself ("impress").
-   **Plugin**: A remote module integrated into the host to provide UI components.
-   **Module Federation**: The technology that enables runtime module sharing between separate applications.

<br>

### Features and Limitations
**Features:**
-   Add new UI components.
-   Reuse host UI components.
-   Dynamically inject components via CSS selectors and a [configuration file](#plugin-configuration-file-reference "See the configuration file reference").
-   Integrate without rebuilding or redeploying the host application.
-   Build and version plugins independently.

<br>

**Limitations:**
-   Focused on DOM/UI customisations; you cannot add Next.js routes or other server-side features.
-   Runs client-side without direct host state access. Shared caches (e.g., React Query) only work if the dependency is also [shared as a singleton](#choosing-shared-dependencies "Learn about shared dependencies").
-   Host upgrades may require tweaking CSS selectors and matching versions for shared libraries.

<br>

## Getting Started: Building Your First Plugin

A plugin is a standalone React application bundled with Webpack that exposes one or more components via [Module Federation](#4-federation-configuration "See the federation configuration").  
This guide walks you through creating your first plugin.

<br>

### 1. Prepare the Host Environment

Developing a plugin requires running the host application (Docs) in parallel.  
This live integration is essential for rendering your plugin, enabling hot-reloading, sharing types for Intellisense, and discovering the exact versions of [shared dependencies](#choosing-shared-dependencies "Learn about shared dependencies").

<br>

1.  **Clone the repository locally**: If you haven't already, clone the Docs repository to your local machine and follow the initial setup instructions.
2.  **Set the development flag**: In the host application's `.env.development` file, set `NEXT_PUBLIC_DEVELOP_PLUGINS=true`.
3.  **Stop conflicting services**: If you are using the project's Docker setup, make sure the frontend service is stopped (`docker compose stop frontend-development`), as we will run the Docs frontend locally.
4.  **Run the host**: Navigate to `src/frontend/apps/impress`, run `yarn install`, and then `yarn dev`.
5.  **Check the logs**: On startup, the Next.js dev server will print the versions of all shared singleton libraries (e.g., React, styled-components).  
    You will need these exact versions for your plugin's `package.json`.

<br>

### 2. Scaffolding a New Plugin Project

Create a new, simple React project.  
Your project should have a [`webpack.config.js`](#4-federation-configuration "See the federation configuration") and include dependencies for React, Webpack, and TypeScript.

<br>

A minimal `package.json` would look like this:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "scripts": {
    "dev": "webpack serve --mode=development",
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

> Replace `<same as host>` with the versions found in the [host's dev startup log](#1-prepare-the-host-environment "See how to prepare the host").

<br>

### 3\. Creating a Plugin Component

This is a React component that your `webpack.config.js` file exposes.  
This minimal example shows how to accept `props`, which can be passed from the [plugin configuration file](#plugin-configuration-file-reference "See the configuration file reference").

<br>

```typescript
// src/MyCustomComponent.tsx
import React from 'react';

// A simple component with inline prop types
const MyCustomComponent = ({ message }: { message?: string }) => {
  return (
    <div>
      This is the plugin component.
      {message && <p>Message from props: {message}</p>}
    </div>
  );
};

export default MyCustomComponent;
```

<br>

### 4\. Federation Configuration

The core of the plugin is its Webpack configuration.  
All plugins should use this sample `webpack.config.js` as a base.

<br>

```javascript
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const { NativeFederationTypeScriptHost } = require('@module-federation/native-federation-typescript/webpack');

module.exports = (env, argv) => {
  const dev = argv.mode !== 'production';

  const moduleFederationConfig = {
    name: 'my_plugin', // A unique name for your plugin
    filename: 'remoteEntry.js',
    exposes: {
      // Maps a public name to a component file
      './MyCustomComponent': './src/MyCustomComponent.tsx',
    },
    remotes: {
      // Allows importing from the host application. The URL is switched automatically.
      impress: dev
        ? 'impress@http://localhost:3000/_next/static/chunks/remoteEntry.js' // Development
        : 'impress@/_next/static/chunks/remoteEntry.js', // Production
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

> Don't change `remotes.impress` if you want your [released plugin](#releasing-a-plugin "Learn how to release a plugin") to be [deployable by others](#deploying-docs-with-plugins "Learn about deployment").

<br>

### 5\. Enabling Type-Sharing for Intellisense

To get autocompletion for components and hooks exposed by the host, configure your plugin's `tsconfig.json` to find the host's types.

<br>

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

<br>

When you run the host application with `NEXT_PUBLIC_DEVELOP_PLUGINS=true`, it generates a `@mf-types.zip` file.  
The `NativeFederationTypeScriptHost` plugin in your webpack config will automatically download and unpack it, making the host's types available to your plugin and IDE.

<br>

### 6\. Running and Configuring Your Plugin

With the host application already running (from step 1), you can now start your plugin's development server and configure the host to load it.

<br>

1.  **Start the plugin**: In your plugin's project directory, run `yarn dev`.
2.  **Configure the host**: Tell the host to load your plugin by editing its configuration file.  
    When running Docs locally, this file is located at `src/backend/impress/configuration/plugins/default.json`.  
    Update it to point to your local plugin's `remoteEntry.js`.

<br>

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
  },
  "props": {
    "message": "Hello from the configuration!"
  }
}
```

<br>

After changing the `target` to a valid CSS selector in the host's DOM, save the file.  
The host application will automatically detect the change and inject your component, passing the `props` object along.

Your component should appear in the running host application after a reload.

<br>

## Host-Plugin Interaction

### Host Exports

The host automatically exposes many of its components and hooks.  
You can import them in the plugin as if they were local modules, thanks to the [`remotes` configuration](#4-federation-configuration "See the remotes config in Webpack") in the `webpack.config.js`.

<br>

```typescript
// In the plugin's code
import { Icon } from 'impress/components';
import { useAuthQuery } from 'impress/features/auth/api';
```

<br>

### Choosing Shared Dependencies

Sharing dependencies is critical for performance and stability.

<br>

  - **Minimal Shared Libraries**: Always share **`react`**, **`react-dom`**, **`styled-components`**, and **`@openfun/cunningham-react`** to use the same instances as the host.
  - **Sharing State**: Libraries that rely on a global context (like `@tanstack/react-query`) **must** be shared to access the host's state and cache.
  - **Discovering More Shared Libraries**: With `NEXT_PUBLIC_DEVELOP_PLUGINS=true`, [the host prints its shared dependency map to the Next.js dev server logs on startup](#1-prepare-the-host-environment "See how to prepare the host").  
    You can use this to align versions and add more shared libraries to your plugin.

<br>

> **Important**: Both the host and the plugin must declare a dependency in [`moduleFederationConfig.shared`](#4-federation-configuration "See the federation configuration") for it to become a true singleton.  
> If a shared dependency is omitted from the plugin's config, Webpack will bundle a separate copy, breaking the singleton pattern.

<br>

## Development Workflow

### Test and Debug

  - Use the `[PluginSystem]` logs in the browser console to see if the plugin is loading correctly.
  - Errors in the plugin are caught by an `ErrorBoundary` and will not crash the host.

<br>

Common Errors:
| Issue | Cause/Fix |
| :--- | :--- |
| Unreachable `remoteEntry.js` | Check the `url` in the [plugin configuration](#6-running-and-configuring-your-plugin "See how to configure the plugin"). |
| Library version conflicts | Ensure `shared` library versions in `package.json` match the [host's versions](#1-prepare-the-host-environment "See how to check host versions"). |
| Invalid CSS selectors | Validate the `target` selector against the host's DOM. |

<br>

### Best Practices

  - Build modular components with well-typed props.
  - Prefer using the host's exposed types and components over implementing new ones.
  - Keep shared dependency versions aligned with the host and re-test after host upgrades.
  - Treat plugin bundles as untrusted: vet dependencies and avoid unsafe scripts.

<br>

## Plugin Configuration File Reference

This section provides a detailed reference for all fields in the plugin configuration JSON.  
For deployment details, see [Deploying Docs with Plugins](#deploying-docs-with-plugins "Learn about production deployment").

<br>

### Configuration Structure

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique component identifier (e.g., "my-widget"). |
| `remote` | Object | Yes | Remote module details. |
| - `url` | String | Yes | Path to `remoteEntry.js` (absolute/relative). |
| - `name` | String | Yes | Federation remote name (e.g., "myPlugin"). |
| - `module` | String | Yes | Exposed module (e.g., "./Widget"). |
| `injection`| Object | Yes | Integration control. |
| - `target` | String | Yes | CSS selector for insertion point. |
| - `position` | String | No (default: "append") | Insertion position (`before`, `after`, `replace`, `prepend`, `append`). See [examples](#injection-position-examples "See injection examples"). |
| - `observerRoots` | String/Boolean | No | DOM observation: CSS selector, `true` (observe whole document), or `false` (default; disable observers). |
| `props` | Object | No | Props passed to the [plugin component](#3-creating-a-plugin-component "See how to create a component with props"). |
| `visibility` | Object | No | Visibility controls. |
| - `routes` | Array | No | Path globs (e.g., `["/docs/*", "!/docs/secret*"]`); supports `*` and `?` wildcards plus negation (`!`). |

<br>

### Injection Position Examples

The `injection.position` property controls how the plugin is inserted relative to the `target` element.

<details>
<summary>View injection examples</summary>

<br>

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

<br>

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

<br>

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

<br>

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

<br>

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

<br>

## Releasing a Plugin

When you are ready to release your plugin, you need to create a production build.

<br>

Run the build command in your plugin's directory:

```bash
yarn build
```

This command bundles your code for production.  
Webpack will generate a **`dist`** folder (or similar) containing the **`remoteEntry.js`** file and other JavaScript chunks.  
The `remoteEntry.js` is the manifest that tells other applications what modules your plugin exposes.  
These are the files you will need for deployment.

<br>

The [`webpack.config.js` provided](#4-federation-configuration "See the federation configuration") is already configured to switch the `remotes` URL to the correct production path automatically, so no code changes are needed before building.

<br>

## Deploying Docs with Plugins

To use plugins in a production environment, you need to deploy both the plugin assets and the configuration file.  
The recommended approach is to serve the plugin's static files from the same webserver that serves the host (docs frontend).

<br>

1.  **Deploy Plugin Assets**: Copy the contents of your plugin's build output directory (e.g., `dist/`) into the frontend container's `/usr/share/nginx/html/assets` directory at a chosen path.  
    For example, placing assets in `/usr/share/nginx/html/assets/plugins/my-plugin/` would make the plugin's **`remoteEntry.js`** available at `https://production.domain/assets/plugins/my-plugin/remoteEntry.js`.

<br>

2.  **Deploy Plugin Configuration**: The host's [plugin configuration file](#plugin-configuration-file-reference "See the configuration file reference") must be updated to point to the deployed assets.  
    This file is typically managed via infrastructure methods (e.g., a Kubernetes configmap replacing `/app/impress/configuration/plugins/default.json` in the backend container).

<br>

Update the **`remote.url`** to the public-facing path that matches where you deployed the assets:

```json
{
  "id": "my-custom-component",
  "remote": {
    "url": "/assets/plugins/my-plugin/remoteEntry.js",
    "name": "my_plugin",
    "module": "./MyCustomComponent"
  },
  "injection": {
    "target": "#some-element-in-the-host"
  },
  "props": {
    "message": "Hello from production!"
  }
}
```