const path = require('path');

const ts = require('typescript');

/**
 * @file This file configures Module Federation for the 'impress' application.
 * It automatically exposes components and shares dependencies.
 */

/**
 * Extracts the root name of a package from an import specifier.
 * e.g., '@scope/name/foo' becomes '@scope/name', and 'next/link' becomes 'next'.
 * @param {string} spec - The import specifier.
 * @returns {string} The root package name.
 */
function pkgRootName(spec) {
  // '@scope/name/foo' -> '@scope/name', 'next/link' -> 'next'
  if (spec.startsWith('@')) {
    const [scope, name] = spec.split('/');
    return `${scope}/${name || ''}`;
  }
  return spec.split('/')[0];
}

/**
 * Checks if an import specifier is a relative path or a path alias.
 * @param {string} spec - The import specifier.
 * @returns {boolean} True if the path is relative or an alias.
 */
function isRelativeOrAlias(spec) {
  return spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/');
}

/**
 * Builds the key for the 'exposes' object from an absolute file path.
 * This creates a public path like './components/Button' from a file path.
 * @param {string} absPath - The absolute path to the file.
 * @param {string} root - The project root directory.
 * @returns {string} The key for the 'exposes' object.
 */
function buildExposeKey(absPath, root) {
  const relPath = path.relative(root, absPath).replace(/\\/g, '/'); // Convert backslashes to forward slashes

  // Remove 'src/' prefix to create cleaner public paths
  const pathWithoutSrc = relPath.startsWith('src/')
    ? relPath.substring(4)
    : relPath;

  const relNoExt = pathWithoutSrc.replace(/\.(t|j)sx?$/, ''); // Remove file extension
  // Remove '/index' from the end of the path to allow importing the directory
  const withoutIndex = relNoExt.replace(/\/index$/, '');
  return './' + withoutIndex;
}

/**
 * Scans specified folders for TypeScript/JavaScript files to expose via Module Federation.
 * It uses the TypeScript compiler API to find all files with actual runtime exports.
 * @param {string[]} folders - An array of folder paths to scan.
 * @returns {{exposes: Record<string, string>, program: ts.Program}} An object containing the exposed modules and the TypeScript program instance.
 */
function makeExposes(folders) {
  const projectRoot = process.cwd();
  const tsconfigPath = path.resolve(projectRoot, 'tsconfig.json');

  // Read and parse the tsconfig.json file
  const cfg = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (cfg.error) {
    throw new Error(formatTsError('Failed to read tsconfig', cfg.error));
  }

  const parsed = ts.parseJsonConfigFileContent(
    cfg.config,
    ts.sys,
    path.dirname(tsconfigPath),
    undefined,
    tsconfigPath,
  );

  // Create a TypeScript program to analyze the source files
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  const checker = program.getTypeChecker();

  const dirSet = new Set(
    folders.map((f) => path.resolve(process.cwd(), f).replace(/\\/g, '/')),
  );
  const exposes = {};
  const used = new Set(); // Tracks used expose keys to detect duplicates

  for (const sf of program.getSourceFiles()) {
    // Skip declaration files (.d.ts)
    if (sf.isDeclarationFile) {
      continue;
    }
    const abs = sf.fileName.replace(/\\/g, '/');

    // Only include files from the specified folders
    if (
      ![...dirSet].some((dir) =>
        abs.startsWith(dir.endsWith('/') ? dir : dir + '/'),
      )
    ) {
      continue;
    }

    // Only include valid script files
    const ext = path.extname(abs).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      continue;
    }

    // Exclude node_modules, test files, and mocks
    if (
      abs.includes('/node_modules/') ||
      /[.-](test|spec|stories)\.(t|j)sx?$/.test(abs) ||
      abs.includes('/__tests__/') ||
      abs.includes('/__mocks__/')
    ) {
      continue;
    }

    const moduleSymbol = sf.symbol;
    if (!moduleSymbol) {
      continue;
    }

    // Check if the module has any runtime exports (values, not just types)
    const hasRuntime = checker.getExportsOfModule(moduleSymbol).some((sym) => {
      const tgt =
        sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
      return (tgt.getFlags() & ts.SymbolFlags.Value) !== 0;
    });
    if (!hasRuntime) {
      continue;
    }

    const key = buildExposeKey(abs, process.cwd());
    const rel = './' + path.relative(process.cwd(), abs).replace(/\\/g, '/');

    // Handle duplicate keys, preferring non-index files
    if (used.has(key)) {
      const isNewFileIndex = path.basename(abs, path.extname(abs)) === 'index';
      const existingPath = exposes[key];

      console.warn(
        `[makeExposes] Duplicate expose key "${key}". ` +
          `${isNewFileIndex ? 'Skipping index file' : 'Keeping first occurrence'}: "${rel}". ` +
          `Existing: "${existingPath}".`,
      );
      if (isNewFileIndex) {
        continue; // Index files lose in case of conflicts
      }
      // Otherwise: the first file encountered keeps the key
    }
    exposes[key] = rel;
    used.add(key);
  }

  return { exposes, program };
}

/**
 * Resolves the installed version of a package.
 * @param {string} pkgName - The name of the package.
 * @param {string} projectRoot - The root directory of the project.
 * @returns {string|null} The installed version, or null if not found.
 */
function resolveInstalledVersion(pkgName, projectRoot) {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
      paths: [projectRoot],
    });
    const { version } = require(pkgJsonPath);
    return version || null; // e.g. "18.3.1"
  } catch {
    return null; // not installed or cannot resolve
  }
}

/**
 * Automatically determines which dependencies to share based on the imports
 * of the exposed files.
 * @param {object} options - The options for making shared dependencies.
 * @param {ts.Program} options.program - The TypeScript program instance.
 * @param {Record<string, string>} options.exposes - The exposed modules.
 * @param {string[]} [options.include=[]] - A list of packages to include in sharing (e.g., 'react', 'styled-components').
 * @param {string[]} [options.exclude=[]] - A list of packages to exclude from sharing.
 * @returns {Record<string, object>} The shared dependencies configuration.
 */
function makeSharedAuto({ program, exposes, include = [], exclude = [] }) {
  const projectRoot = process.cwd();
  const { dependencies = {}, peerDependencies = {} } = require(
    path.join(projectRoot, 'package.json'),
  );
  const declared = { ...dependencies, ...peerDependencies };

  const wanted = new Set(include);

  const exposedFiles = new Set(
    Object.values(exposes).map((p) =>
      path.resolve(projectRoot, p.replace(/^\.\//, '')).replace(/\\/g, '/'),
    ),
  );

  // Analyze imports of exposed files to find dependencies to share
  for (const sf of program.getSourceFiles()) {
    const abs = sf.fileName.replace(/\\/g, '/');
    if (!exposedFiles.has(abs)) {
      continue;
    }
    const specs = (sf.imports || []).map((n) => n.text).filter(Boolean);
    for (const spec of specs) {
      if (isRelativeOrAlias(spec)) {
        continue;
      }
      wanted.add(pkgRootName(spec));
    }
  }

  // Prune excluded packages
  for (const name of [...wanted]) {
    if (exclude.includes(name)) {
      wanted.delete(name);
    }
  }

  // Build the shared object for Webpack
  return Object.fromEntries(
    [...wanted].map((name) => {
      // Prefer the actually installed version for 'requiredVersion'
      const resolved = resolveInstalledVersion(name, projectRoot);
      // Fallback to the version range from package.json if resolution fails
      const range = declared[name] || undefined;
      const requiredVersion = resolved || range; // Use concrete version when possible

      return [
        name,
        {
          singleton: true,
          eager: false,
          requiredVersion,
          strictVersion: !!resolved, // Enforce exact match if we know the concrete version
          allowNodeModulesSuffixMatch: true,
        },
      ];
    }),
  );
}

/**
 * Formats a TypeScript diagnostic error into a readable string.
 * @param {string} context - A string describing the context of the error.
 * @param {ts.Diagnostic} diag - The TypeScript diagnostic object.
 * @returns {string} The formatted error message.
 */
function formatTsError(context, diag) {
  const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
  return `${context}: ${message}`;
}

// ---------- Final Module Federation Config ----------

// Define which folders should be scanned for exposable modules.
const foldersToExpose = [
  './src/components',
  './src/features/auth',
  './src/cunningham',
];
const { exposes, program } = makeExposes(foldersToExpose);

// Automatically determine shared dependencies based on the imports of exposed files.
const shared = makeSharedAuto({
  program,
  exposes,
  include: ['react', 'react-dom', 'styled-components', 'yjs'],
  exclude: ['next'], // Packages to never share
});

const moduleFederationConfig = {
  name: 'impress',
  filename: 'static/chunks/remoteEntry.js',
  extraOptions: { skipSharingNextInternals: true },

  // The modules exposed by this federated module.
  exposes,

  // The shared dependencies for this federated module.
  shared,

  // TypeScript type generation for plugin development.
  // This is enabled when NEXT_PUBLIC_DEVELOP_PLUGINS is 'true'.
  dts:
    process.env.NEXT_PUBLIC_DEVELOP_PLUGINS === 'true'
      ? {
          generateTypes: {
            extractThirdParty: true,
            tsConfigPath: './tsconfig.json',
          },
        }
      : false,
};

module.exports = { moduleFederationConfig };
