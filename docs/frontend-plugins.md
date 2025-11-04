## Overview

The plugin system allows developers to extend the application's functionality and appearance without modifying the core. It's ideal for teams or third parties to add custom features.

### Glossary
- **Remote**: An application exposing components via module federation.
- **Host**: The main entry point application. This is Docs itself ("impress")
- **Plugin**: A remote module integrated into the host to provide UI components.
- **Module Federation**: Technology for runtime module sharing between apps.
- **Container**: Environment executing a remote module.
- **Exposed Module**: A module or component made available by a remote.

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

### Overview
This diagram shows the plugin integration flow: fetching config and plugins, checking visibility, starting DOM observation, conditionally rendering components, and re-checking on DOM changes.


```mermaid
flowchart TD
  subgraph Host
  A["Fetches Config<br>(default.json)"] --> B["Fetches Plugins<br>(remoteEntry.js)"]
  B --> C["Checks Visibility<br>(route matches)"]
  C --> F["Checks if Targets exist<br>(CSS selector)"]
  F --> G["Checks if Component already injected"]
  G --> D["Render Component with Props into Targets"]
  D --> H["Start DOM Observer<br>(if enabled)"]
  H -.-> C
  end
```


## Configuration

Plugins are configured via a JSON file (e.g., `impress/configuration/plugins/default.json`) loaded at runtime by the host. Place it in the backend, via a Docker volume for single-file drop-in or Kubernetes ConfigMap.

### Structure
| Field       | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `id`       | String | Yes     | Unique component identifier (e.g., "my-widget"). |
| `remote`   | Object | Yes     | Remote module details. |
|   - `url`  | String | Yes     | Path to `remoteEntry.js` (absolute/relative). |
|   - `name` | String | Yes     | Federation remote name (e.g., "myPlugin"). |
|   - `module` | String | Yes   | Exposed module (e.g., "./Widget"). |
| `injection`| Object | Yes     | Integration control. |
|   - `target` | String | Yes   | CSS selector for insertion point. |
|   - `position` | String | No (default: "append") | Insertion position (`before`, `after`, `replace`, `prepend`, `append`). |
|   - `observerRoots` | String/Boolean | No | DOM observation: CSS selector, `true` (default; observe whole document), `false` (disable observers). |
| `props`    | Object | No      | Props passed to the plugin component. |
| `visibility` | Object | No    | Visibility controls. |
|   - `routes` | Array  | No     | Path globs (e.g., `["/docs/*", "!/docs/secret*"]`); supports `*` and `?` wildcards plus negation (`!`). |


### Example
```json
{
  "id": "my-custom-component-1",
  "remote": {
    "url": "http://localhost:3001/remoteEntry.js",
    "name": "my-plugin",
    "module": "./MyCustomComponent"
  },
  "injection": {
    "target": "#list #item3",
    "position": "append",
    "observerRoots": "#list"
  },
  "props": {
    "title": "My Widget",
    "color": "#ffcc00"
  },
  "visibility": {
    "routes": ["/docs/*", "!/docs/secret*"]
  }
}
```

### Key Notes
- `remote` and `injection` are required.
    - `remote.url` can be relative if the plugin's compiled `remoteEntry.js` is placed in the host's public folder (e.g. via k8s ConfigMap)
      ```diff
      - "url": "http://localhost:3001/remoteEntry.js",
      + "url": "/plugins/my-plugin/remoteEntry.js",
      ```
- Use `target`/`position` for flexible placement (e.g., replace or append).
- `observerRoots` controls DOM observation for reinjection. Prefer the closest stable ancestor selector (e.g. `"#list"`); leaving it as `true` watches the whole document and is noisier.
- Restrict visibility with `routes` globs and negations.
- Pass custom data via `props`.
- Plugins execute on the client only; avoid assumptions that rely on server-side rendering.


#### `injection.position`

Below are simple examples for all possible values.<br>
Each shows the relevant JSON config and the resulting HTML structure after injection:


**before**
```json
{
  "injection": {
    "target": "#list #item3",
    "position": "before",
    "observerRoots": "#list"
  }
}
```
```html
<ul id="list">
  <li id="item1"></li>
  <li id="item2"></li>
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item3"></li>
</ul>
```

**after**
```json
{
  "injection": {
    "target": "#list #item1",
    "position": "after",
    "observerRoots": "#list"
  }
}
```
```html
<ul id="list">
  <li id="item1"></li>
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item2"></li>
  <li id="item3"></li>
</ul>
```

**prepend**
```json
{
  "injection": {
    "target": "#list",
    "position": "prepend",
    "observerRoots": "#list"
  }
}
```
```html
<ul id="list">
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item1"></li>
  <li id="item2"></li>
  <li id="item3"></li>
</ul>
```

**append**
```json
{
  "injection": {
    "target": "#list",
    "position": "append",
    "observerRoots": "#list"
  }
}
```
```html
<ul id="list">
  <li id="item1"></li>
  <li id="item2"></li>
  <li id="item3"></li>
  <div id="plugin-container-my-custom-component-0"></div>
</ul>
```

**replace**
```json
{
  "injection": {
    "target": "#list #item2",
    "position": "replace",
    "observerRoots": "#list"
  }
}
```
```html
<ul id="list">
  <li id="item1"></li>
  <div id="plugin-container-my-custom-component-0"></div>
  <li id="item2" data-pluginsystem-hidden="true"></li>
  <li id="item3"></li>
</ul>
```


## Development Guide

### Environment Variables
Set `NEXT_PUBLIC_DEVELOP_PLUGINS=true` in `.env.development` for debug logs, type-sharing, and hot-reload support. The Next.js dev server prints the resolved exposes and shared singleton versions on startup, helping match plugin dependencies.

### Type-Sharing for Intellisense
In plugin `tsconfig.json`:
```json
{
  "baseUrl": ".",
  "paths": {
    "*": ["./@mf-types/*"]
  }
}
```
Types update on build for autocompletion: with `NEXT_PUBLIC_DEVELOP_PLUGINS=true` the host serves `/_next/static/chunks/@mf-types.zip`, and the sample `NativeFederationTypeScriptHost` in `webpack.config.js` unpacks it so the `@mf-types/*` aliases resolve locally.

### Exports Support
The host automatically exposes components and some features under the same structure that is used in docs code.

```typescript
// Direct import
import { useAuthQuery } from 'impress/features/auth/api/useAuthQuery';
import { Icon } from 'impress/components/Icon';

// Clean barrel export import
import { useAuthQuery } from 'impress/features/auth/api';
import { Icon } from 'impress/components';
```

**Important Notes:**
- Only barrel exports with runtime values are exposed (not type-only exports)
- In case of naming conflicts (e.g., `Button.tsx` and `Button/index.tsx`), explicit files take precedence over barrel exports
- The host logs warnings for any naming conflicts during build

### Recommended Workflow
1. Enable `NEXT_PUBLIC_DEVELOP_PLUGINS` and start host (docs) & plugin dev servers in parallel.
2. Configure federation in plugin `webpack.config.js` and expose components (see Examples).
3. Develop with hot-reload; use host components via shared types.
4. Test in host via config; debug with logs.
5. Version and deploy independently.

### Integration in Host
1. Build plugin and host `remoteEntry.js`.
2. Add to host config JSON.
3. Start host; plugin loads at runtime.
4. Verify via `[PluginSystem]` logs.

### Debugging
With `NEXT_PUBLIC_DEVELOP_PLUGINS=true`, `[PluginSystem]` console logs surface load, inject, and error events.

Common Errors:
| Issue                  | Cause/Fix |
|------------------------|-----------|
| Unreachable `remoteEntry.js` | Check URL; ensure accessible. |
| Library version conflicts | Match React/etc. versions; use singletons in federation. |
| Invalid CSS selectors | Validate `target` against host DOM. |
| Type mismatches       | Update shared types on build. |

Errors are isolated via host ErrorBoundary.

## Best Practices and Security

### Best Practices
- Build modular components with well-typed props so host teams can plug them in safely.
- Use the host's exposed types/components rather than private internals.
- Keep shared dependency versions aligned with the host and retest after upgrades.
- During development run the plugin and host dev servers in parallel so you benefit from hot reload and live Module Federation.

### Security and Isolation
- Plugins run behind ErrorBoundaries, keeping failures isolated but still worth monitoring.
- Host state is inaccessible; rely on props and exposed APIs.
- Treat plugin bundles as untrusted: vet dependencies, avoid unsafe external scripts, and re-test after host changes.

## Examples

### Federation Configuration (webpack.config.js)
Define `moduleFederationConfig` first for reuse:

```js
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const { NativeFederationTypeScriptHost } = require('@module-federation/native-federation-typescript/webpack');

const moduleFederationConfig = {
  name: 'my-plugin',
  filename: 'remoteEntry.js',
  exposes: {
    './MyCustomComponent': './src/MyCustomComponent.tsx',
  },
  remotes: {
    impress: 'impress@http://localhost:3000/_next/static/chunks/remoteEntry.js',
  },
  shared: {
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
    entry: './src/index.tsx',
    plugins: [
      new ModuleFederationPlugin(moduleFederationConfig),
      ...(dev ? [NativeFederationTypeScriptHost({ moduleFederationConfig })] : []),
    ],
  };
};
```
Adjust names/paths; declare shared libs as singletons. Use relative remotes if the plugin `remoteEntry.js` lives in host's public folder (e.g., `public/plugins/my-plugin/remoteEntry.js`).
```diff
- impress: 'impress@localhost:3000/_next/static/chunks/remoteEntry.js'
+ impress: 'impress@/_next/static/chunks/remoteEntry.js',
```

### Choosing Shared Dependencies

The `shared` configuration in `webpack.config.js` is critical for performance and stability. Here’s a guide to help you decide which dependencies to share:

-   **Minimal Shared Libraries**: Your plugin should always share `react`, `react-dom`, `styled-components`, and `@openfun/cunningham-react`. This ensures that your plugin uses the same core libraries as the host, preventing version conflicts and unnecessary duplication.

-   **Sharing State**: Libraries that rely on a global cache or context (e.g. `@tanstack/react-query`) must be shared. If each bundle ships its own copy, the React Query context and cache live in parallel universes—the plugin's hooks will not see the host's `QueryClient`, forcing duplicate fetches or even errors. Align your plugin's dependency version with the host so the Module Federation singleton can reuse the host instance instead of bundling a second copy.

-   **Expanding Shared Libraries**: Before adding a new library to your plugin, check if the host already provides it. Running the host with `NEXT_PUBLIC_DEVELOP_PLUGINS=true` prints the effective `moduleFederationConfig.shared` map (singletons + versions) to the Next.js dev server logs on startup, so you can align your plugin's `package.json` without guessing. Reusing host-provided libraries keeps the plugin lightweight and avoids duplicate bundles.


For plugin config example, see Configuration section.

## Summary
The plugin system enables runtime frontend extensions via module federation, with easy config, type-sharing, and independent deployment. Focus on UI mods, match versions, and test for compatibility. Use the diagram, tables, and examples for quick reference.