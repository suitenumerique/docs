import { ESLint } from 'eslint';

interface PluginMeta {
  name: string;
  version: string;
  namespace: string;
}

interface PluginConfig {
  meta: PluginMeta;
  configs: {
    base: ESLint.ConfigData[];
    next: ESLint.ConfigData[];
    test: ESLint.ConfigData[];
    playwright: ESLint.ConfigData[];
  };
}

declare const plugin: PluginConfig;
export = plugin;
