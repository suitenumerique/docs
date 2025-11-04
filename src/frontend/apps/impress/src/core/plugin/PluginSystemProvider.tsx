/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/* NOTE: CSR-only module. Assumes DOM availability. */
import { createInstance, getInstance } from '@module-federation/runtime';
import type { ModuleFederation } from '@module-federation/runtime-core';
import { useRouter } from 'next/router';
import React, {
  ComponentType,
  FC,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useConfig } from '@/core/config';

/**
 * Plugin System (CSR)
 */

const DEBUG_PLUGINS = process.env.NEXT_PUBLIC_DEVELOP_PLUGINS === 'true';
const LOG = DEBUG_PLUGINS
  ? {
      debug: (...args: any[]) => console.debug('[PluginSystem]', ...args),
      groupStart: (label: string) =>
        console.groupCollapsed(`[PluginSystem] ${label}`),
      groupEnd: () => console.groupEnd(),
    }
  : { debug() {}, groupStart() {}, groupEnd() {} };

const PLUGIN_CONSTANTS = {
  bootstrapTimeoutMs: 10000,
  remoteLoadTimeoutMs: 8000,
  routeRefreshDebounceMs: 60,
} as const;

/** DOM/time helpers */
const isHTMLElement = (el: Element): el is HTMLElement =>
  el instanceof HTMLElement;
const queryAll = (selector: string): Element[] =>
  Array.from(document.querySelectorAll(selector));
const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/** Glob → RegExp with '*' and '?' and '!' negation support */
const escapeRegExpExceptWildcards = (pattern: string): string =>
  pattern
    .replace(/\*/g, '__WILDCARD_STAR__')
    .replace(/\?/g, '__WILDCARD_Q__')
    .replace(/[.*+?^${}()|[\]\\]/g, '$&')
    .replace(/__WILDCARD_STAR__/g, '*')
    .replace(/__WILDCARD_Q__/g, '?');
const globToRegex = (pattern: string): RegExp =>
  new RegExp(
    `^${escapeRegExpExceptWildcards(pattern).replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
  );

type CompiledRoutes = { include: RegExp[]; exclude: RegExp[] };
const compileRoutes = (patterns?: string[]): CompiledRoutes => {
  const list = patterns ?? [];
  const include = list.filter((p) => !p.startsWith('!')).map(globToRegex);
  const exclude = list
    .filter((p) => p.startsWith('!'))
    .map((p) => globToRegex(p.slice(1)));
  return { include, exclude };
};
const isRouteEligible = (
  pathname: string,
  compiled: CompiledRoutes,
): boolean => {
  const included =
    compiled.include.length === 0 ||
    compiled.include.some((re) => re.test(pathname));
  const excluded = compiled.exclude.some((re) => re.test(pathname));
  return included && !excluded;
};

/** Same-origin aware origin warmup (DNS/TCP/TLS ping for cross-origin only). */
const warmedOrigins = new Set<string>();
const isCrossOrigin = (url: string): boolean => {
  try {
    const u = new URL(url, window.location.href);
    return u.origin !== window.location.origin;
  } catch (err) {
    LOG.debug('isCrossOrigin url parse error', err);
    return false;
  }
};
const warmupOriginOnce = (maybeRelativeUrl: string) => {
  try {
    if (!isCrossOrigin(maybeRelativeUrl)) {
      return;
    }
    const origin = new URL(maybeRelativeUrl, window.location.href).origin;
    if (warmedOrigins.has(origin)) {
      return;
    }
    warmedOrigins.add(origin);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = `${origin}/favicon.ico?ps=${Date.now()}`;
    LOG.debug('warm origin', origin);
  } catch (err) {
    LOG.debug('warmupOriginOnce error', err);
  }
};

/** Public config shape — `id` is MANDATORY. */
export interface PluginConfig {
  id: string;
  remote: {
    url: string; // absolute or relative path to remoteEntry.js
    name: string; // federation remote name
    module: string; // exposed module, e.g. "./Widget" or "Widget"
  };
  injection: {
    target: string; // CSS selector
    position?: 'before' | 'after' | 'replace' | 'prepend' | 'append';
    observerRoots?: string | boolean; // selector, true (document), or false (none)
  };
  props?: Record<string, unknown>;
  visibility?: { routes?: string[] }; // glob + !negation
}

/** Minimal timing/incident tracking */
type PluginTiming = {
  register?: number;
  loadStart?: number;
  resolved?: number;
  render?: number;
};
interface PluginIncidents {
  incidentCountsByCode: Record<string, number>;
  incidentCodesLoggedOnce: Set<string>;
}

/** Trust-first normalize: assumes correct shape; applies only defaults. */
const normalizePluginConfigStrict = (
  raw: any,
): Required<PluginConfig> | null => {
  try {
    if (
      !raw ||
      !raw.id ||
      !raw.remote?.url ||
      !raw.remote?.name ||
      !raw.remote?.module ||
      !raw.injection?.target
    ) {
      LOG.debug('skip plugin (invalid shape)');
      return null;
    }
    return {
      id: String(raw.id),
      remote: {
        url: String(raw.remote.url),
        name: String(raw.remote.name),
        module: String(raw.remote.module),
      },
      injection: {
        target: String(raw.injection.target),
        position: raw.injection.position ?? 'append',
        observerRoots: raw.injection.observerRoots ?? false,
      },
      props: (raw.props as Record<string, unknown>) ?? {},
      visibility: {
        routes: (Array.isArray(raw.visibility?.routes)
          ? raw.visibility.routes
          : []) as string[],
      },
    };
  } catch (err) {
    LOG.debug('skip plugin (exception during normalize)', err);
    return null;
  }
};

/** Context */
interface PluginSystemContextType {
  registry: PluginRegistry;
  pluginConfigs: Required<PluginConfig>[];
  isLoading: boolean;
  /** Remove all containers & observers for a plugin immediately (e.g., on render error). */
  ejectPlugin: (pluginId: string) => void;
}
const PluginSystemContext = createContext<PluginSystemContextType>(
  null as unknown as PluginSystemContextType,
);
export const usePluginSystem = (): PluginSystemContextType =>
  useContext(PluginSystemContext);

/** Error isolation for plugin render */
class PluginErrorBoundary extends React.Component<
  { children: ReactNode; onError?: (err: unknown) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    LOG.debug('Plugin crashed', error);
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return <>{this.props.children}</>;
  }
}

/** MF instance */
let federation: ModuleFederation | null = null;
const ensureFederationInstance = (): ModuleFederation =>
  federation ||
  (federation =
    getInstance() ?? createInstance({ name: 'impress', remotes: [] }));

/** Timing logging */
const logTimingDeltas = (pluginId: string, t: PluginTiming) => {
  LOG.debug('timings', pluginId, {
    registerToLoadStart:
      t.register && t.loadStart
        ? `${(t.loadStart - t.register).toFixed(1)}ms`
        : undefined,
    loadStartToResolved:
      t.loadStart && t.resolved
        ? `${(t.resolved - t.loadStart).toFixed(1)}ms`
        : undefined,
    resolvedToFirstRender:
      t.resolved && t.render
        ? `${(t.render - t.resolved).toFixed(1)}ms`
        : undefined,
  });
};

/** Registry: loads/stores plugin components; dedupes inflight; logs incidents */
export class PluginRegistry {
  private pluginsById = new Map<string, ComponentType<unknown>>();
  private registeredRemoteNames = new Set<string>(); // (1) dedupe by name only
  private inflightRemoteLoadsByKey = new Map<string, Promise<unknown>>(); // (2) name/module key
  private pluginMetaById = new Map<
    string,
    { timing: PluginTiming; incidents: PluginIncidents }
  >();

  private remoteKey(config: Required<PluginConfig>): string {
    const modulePath = config.remote.module.startsWith('./')
      ? config.remote.module.slice(2)
      : config.remote.module;
    return `${config.remote.name}/${modulePath}`;
  }

  private meta(pluginId: string) {
    let m = this.pluginMetaById.get(pluginId);
    if (!m) {
      m = {
        timing: {},
        incidents: {
          incidentCountsByCode: {},
          incidentCodesLoggedOnce: new Set(),
        },
      };
      this.pluginMetaById.set(pluginId, m);
    }
    return m;
  }

  registerRemote(config: Required<PluginConfig>): void {
    try {
      // (6) centralize warmup
      warmupOriginOnce(config.remote.url);

      if (this.registeredRemoteNames.has(config.remote.name)) {
        return;
      }
      const registerStart = now();
      ensureFederationInstance().registerRemotes([
        { name: config.remote.name, entry: config.remote.url },
      ]);
      this.registeredRemoteNames.add(config.remote.name);
      const meta = this.meta(config.id);
      if (!meta.timing.register) {
        meta.timing.register = registerStart;
      }
      LOG.debug(
        'registered remote',
        config.id,
        config.remote.name,
        config.remote.url,
      );
    } catch (err) {
      this.recordIncident(config.id, 'remote_register_error', err);
      LOG.debug('registerRemote error', err);
    }
  }

  private withTimeoutOrError<T>(
    promise: Promise<T>,
    timeoutMs: number,
    pluginId: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.recordIncident(pluginId, 'remote_load_timeout');
        reject(new Error('remote_load_timeout'));
      }, timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          this.recordIncident(pluginId, 'remote_load_error', error);
          reject(error);
        });
    });
  }

  private recordIncident(pluginId: string, code: string, detail?: unknown) {
    const m = this.meta(pluginId);
    m.incidents.incidentCountsByCode[code] =
      (m.incidents.incidentCountsByCode[code] ?? 0) + 1;
    if (!m.incidents.incidentCodesLoggedOnce.has(code)) {
      m.incidents.incidentCodesLoggedOnce.add(code);
      LOG.debug('error', {
        pluginId,
        code,
        note: 'suppressing repeats',
        detail:
          detail instanceof Error
            ? { message: detail.message, stack: detail.stack }
            : detail,
      });
    }
  }

  private summarizeAndResetIncidents(pluginId: string) {
    const m = this.pluginMetaById.get(pluginId);
    if (!m) {
      return;
    }
    for (const code of Object.keys(m.incidents.incidentCountsByCode)) {
      const count = m.incidents.incidentCountsByCode[code];
      if (count > 1) {
        LOG.debug('errors summary', {
          pluginId,
          code,
          repeatsSuppressed: count - 1,
        });
      }
    }
    m.incidents = {
      incidentCountsByCode: {},
      incidentCodesLoggedOnce: new Set(),
    };
  }

  markRender(pluginId: string) {
    const m = this.meta(pluginId);
    if (!m.timing.render) {
      m.timing.render = now();
      logTimingDeltas(pluginId, m.timing);
      this.summarizeAndResetIncidents(pluginId);
    }
  }

  reportRenderError(pluginId: string, error?: unknown) {
    this.recordIncident(pluginId, 'render_error', error);
  }

  async loadPlugin(
    config: Required<PluginConfig>,
  ): Promise<ComponentType<unknown> | null> {
    try {
      this.registerRemote(config);

      const inflightKey = this.remoteKey(config);
      const meta = this.meta(config.id);
      meta.timing.loadStart = now();

      let remoteModulePromise = this.inflightRemoteLoadsByKey.get(inflightKey);
      if (!remoteModulePromise) {
        remoteModulePromise =
          ensureFederationInstance().loadRemote(inflightKey);
        this.inflightRemoteLoadsByKey.set(inflightKey, remoteModulePromise);
      } else {
        LOG.debug('reusing inflight load', inflightKey);
      }

      let remoteModule: unknown;
      try {
        remoteModule = await this.withTimeoutOrError(
          remoteModulePromise,
          PLUGIN_CONSTANTS.remoteLoadTimeoutMs,
          config.id,
        );
      } finally {
        this.inflightRemoteLoadsByKey.delete(inflightKey);
      }

      const component =
        (typeof remoteModule === 'object' &&
          remoteModule &&
          'default' in (remoteModule as any) &&
          (remoteModule as any).default) ||
        (typeof remoteModule === 'function' && (remoteModule as any)) ||
        null;

      if (component) {
        this.pluginsById.set(config.id, component as ComponentType<unknown>);
        meta.timing.resolved = now();
        LOG.debug('plugin component stored', config.id);
        return component as ComponentType<unknown>;
      }
      LOG.debug('remote loaded but no component', config.id);
    } catch (error: any) {
      const code = (error && error.message) || 'unknown_error';
      this.recordIncident(config.id, code, error);
      LOG.debug(`Failed to load plugin ${config.id}`, { code, error });
    }
    return null;
  }

  getPlugin(pluginId: string): ComponentType<unknown> | undefined {
    const pluginComponent = this.pluginsById.get(pluginId);
    LOG.debug('getPlugin', pluginId, !!pluginComponent);
    return pluginComponent;
  }
}

/** Container events */
type ContainerEvents = {
  add: (pluginId: string, containerElement: Element) => void;
  remove: (pluginId: string, containerElement: Element) => void;
  clear: (pluginId: string) => void;
};

const getOrCreateSet = <T,>(map: Map<string, Set<T>>, key: string): Set<T> => {
  let set = map.get(key);
  if (!set) {
    set = new Set<T>();
    map.set(key, set);
  }
  return set;
};

/** DOM injector */
class DOMPluginInjector {
  private registry: PluginRegistry;
  private containerEvents: ContainerEvents;
  private containersByPluginId = new Map<string, Element[]>();
  private observersByRootElement = new WeakMap<
    Element,
    { observer: MutationObserver; refPluginIds: Set<string> }
  >();
  private rootElementsByPluginId = new Map<string, Set<Element>>();
  private hiddenTargetsByPluginId = new Map<string, Set<HTMLElement>>(); // for data-attr cleanup
  private preHiddenTargetsByPluginId = new Map<string, Set<HTMLElement>>(); // (3) inline content-visibility
  private pluginConfigById = new Map<string, Required<PluginConfig>>();
  private injectionCallbackByPluginId = new Map<string, () => void>();
  private bootstrapPendingPluginIds = new Set<string>();
  private bootstrapTimeoutIdByPluginId = new Map<string, number>();
  private rafScheduledByPluginId = new Map<string, number>();

  constructor(registry: PluginRegistry, containerEvents: ContainerEvents) {
    this.registry = registry;
    this.containerEvents = containerEvents;
    LOG.debug('DOMPluginInjector constructed');
  }

  start(configs: Required<PluginConfig>[]): void {
    LOG.debug(
      'injector.start',
      configs.map((c) => c.id),
    );
    configs.forEach((config) => this.registerPlugin(config));
  }

  stop(pluginId: string): void {
    LOG.groupStart(`injector.stop ${pluginId}`);
    const rootElementsForPlugin = this.rootElementsByPluginId.get(pluginId);
    if (rootElementsForPlugin) {
      rootElementsForPlugin.forEach((rootElement) => {
        const observerRecord = this.observersByRootElement.get(rootElement);
        if (!observerRecord) {
          return;
        }
        observerRecord.refPluginIds.delete(pluginId);
        if (observerRecord.refPluginIds.size === 0) {
          observerRecord.observer.disconnect();
          this.observersByRootElement.delete(rootElement);
        }
      });
      this.rootElementsByPluginId.delete(pluginId);
    }

    // Clean hidden attributes
    const hiddenTargets = this.hiddenTargetsByPluginId.get(pluginId);
    if (hiddenTargets) {
      hiddenTargets.forEach((el) =>
        el.removeAttribute('data-pluginsystem-hidden'),
      );
      this.hiddenTargetsByPluginId.delete(pluginId);
    }
    // Clean pre-hide inline style
    const preHiddenTargets = this.preHiddenTargetsByPluginId.get(pluginId);
    if (preHiddenTargets) {
      preHiddenTargets.forEach((el) =>
        el.style.removeProperty('content-visibility'),
      );
      this.preHiddenTargetsByPluginId.delete(pluginId);
    }

    const containers = this.containersByPluginId.get(pluginId) || [];
    containers.forEach((containerElement) => {
      this.containerEvents.remove(pluginId, containerElement);
      containerElement.parentNode?.removeChild(containerElement);
    });
    this.containersByPluginId.delete(pluginId);

    this.pluginConfigById.delete(pluginId);
    this.injectionCallbackByPluginId.delete(pluginId);
    this.bootstrapPendingPluginIds.delete(pluginId);
    const timeoutIdToClear = this.bootstrapTimeoutIdByPluginId.get(pluginId);
    if (timeoutIdToClear) {
      clearTimeout(timeoutIdToClear);
      this.bootstrapTimeoutIdByPluginId.delete(pluginId);
    }
    const scheduledRafId = this.rafScheduledByPluginId.get(pluginId);
    if (scheduledRafId) {
      cancelAnimationFrame(scheduledRafId);
    }
    this.rafScheduledByPluginId.delete(pluginId);

    this.containerEvents.clear(pluginId);
    LOG.groupEnd();
  }

  destroy(): void {
    LOG.debug('injector.destroy begin');
    const allPluginIds = new Set<string>([
      ...Array.from(this.rootElementsByPluginId.keys()),
      ...Array.from(this.containersByPluginId.keys()),
      ...Array.from(this.hiddenTargetsByPluginId.keys()),
      ...Array.from(this.preHiddenTargetsByPluginId.keys()),
      ...Array.from(this.pluginConfigById.keys()),
    ]);
    allPluginIds.forEach((pluginId) => this.stop(pluginId));
    LOG.debug('injector.destroy complete');
  }

  getContainers(pluginId: string): Element[] {
    return this.containersByPluginId.get(pluginId) || [];
  }

  refresh(allowBootstrap = false): void {
    // FIX TS2554: only one argument for groupStart
    LOG.groupStart(
      `injector.refresh${allowBootstrap ? ' (bootstrap: yes)' : ''}`,
    );
    Array.from(this.pluginConfigById.values()).forEach((pluginConfig) => {
      const pluginId = pluginConfig.id;
      const injectionCallback =
        this.injectionCallbackByPluginId.get(pluginId) ?? (() => {});
      this.attachRootsFor(
        pluginId,
        pluginConfig.injection.observerRoots,
        injectionCallback,
        allowBootstrap, // (10) retry bootstrap on route change if requested
      );
    });
    LOG.groupEnd();
  }

  private scheduleInjectionWithAnimationFrame(
    pluginId: string,
    injectionCallback: () => void,
  ) {
    if (!document || !document.documentElement.isConnected) {
      return;
    }
    if (this.rafScheduledByPluginId.has(pluginId)) {
      return;
    }
    const rafId = requestAnimationFrame(() => {
      this.rafScheduledByPluginId.delete(pluginId);
      injectionCallback();
    });
    this.rafScheduledByPluginId.set(pluginId, rafId);
  }

  private getNearestCommonAncestor(elements: Element[]): Element | null {
    if (!elements.length) {
      return null;
    }

    let candidate: Element | null = elements[0];

    const allContainedBy = (container: Element) =>
      elements.every((el) => container.contains(el));

    while (candidate && candidate !== document.documentElement) {
      if (allContainedBy(candidate)) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return document.documentElement;
  }

  private attachRootObserver(
    rootElement: Element,
    pluginId: string,
    injectionCallback: () => void,
  ): void {
    const rootSetForPlugin = getOrCreateSet(
      this.rootElementsByPluginId,
      pluginId,
    );
    const observerRecord = this.observersByRootElement.get(rootElement);
    if (observerRecord) {
      observerRecord.refPluginIds.add(pluginId);
      rootSetForPlugin.add(rootElement);
      return;
    }
    const observer = new MutationObserver(() =>
      this.scheduleInjectionWithAnimationFrame(pluginId, injectionCallback),
    );
    observer.observe(rootElement, { childList: true, subtree: true });
    this.observersByRootElement.set(rootElement, {
      observer,
      refPluginIds: new Set([pluginId]),
    });
    rootSetForPlugin.add(rootElement);
  }

  private attachBootstrapObserver(
    ancestor: Element,
    pluginId: string,
    selector: string,
  ): void {
    const injectionCallback =
      this.injectionCallbackByPluginId.get(pluginId) ?? (() => {});
    const tryAttachRoots = () => {
      const foundRoots = queryAll(selector);
      if (!foundRoots.length) {
        return;
      }

      const rootObserverRecord = this.observersByRootElement.get(ancestor);
      if (rootObserverRecord) {
        rootObserverRecord.refPluginIds.delete(pluginId);
        if (rootObserverRecord.refPluginIds.size === 0) {
          rootObserverRecord.observer.disconnect();
          this.observersByRootElement.delete(ancestor);
        }
      }
      this.rootElementsByPluginId.get(pluginId)?.delete(ancestor);

      const nca = this.getNearestCommonAncestor(foundRoots);
      if (nca) {
        this.attachRootObserver(nca, pluginId, injectionCallback);
      } else {
        foundRoots.forEach((rootElement) =>
          this.attachRootObserver(rootElement, pluginId, injectionCallback),
        );
      }
      this.bootstrapPendingPluginIds.delete(pluginId);
      const timeoutId = this.bootstrapTimeoutIdByPluginId.get(pluginId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.bootstrapTimeoutIdByPluginId.delete(pluginId);
      }
      injectionCallback();
    };

    const existingRootObserver = this.observersByRootElement.get(ancestor);
    if (existingRootObserver) {
      existingRootObserver.refPluginIds.add(pluginId);
    } else {
      const bootstrapObserver = new MutationObserver(() =>
        this.scheduleInjectionWithAnimationFrame(pluginId, tryAttachRoots),
      );
      bootstrapObserver.observe(ancestor, { childList: true, subtree: true });
      this.observersByRootElement.set(ancestor, {
        observer: bootstrapObserver,
        refPluginIds: new Set([pluginId]),
      });
    }
    getOrCreateSet(this.rootElementsByPluginId, pluginId).add(ancestor);

    const prevTimeoutId = this.bootstrapTimeoutIdByPluginId.get(pluginId);
    if (prevTimeoutId) {
      clearTimeout(prevTimeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      const rec = this.observersByRootElement.get(ancestor);
      if (rec) {
        rec.refPluginIds.delete(pluginId);
        if (rec.refPluginIds.size === 0) {
          rec.observer.disconnect();
          this.observersByRootElement.delete(ancestor);
        }
      }
      this.rootElementsByPluginId.get(pluginId)?.delete(ancestor);
      this.bootstrapPendingPluginIds.delete(pluginId);
      this.bootstrapTimeoutIdByPluginId.delete(pluginId);
      LOG.debug('bootstrap timeout; selector not found', pluginId, selector);
    }, PLUGIN_CONSTANTS.bootstrapTimeoutMs) as unknown as number;
    this.bootstrapTimeoutIdByPluginId.set(pluginId, timeoutId);
  }

  private invokeInjection(pluginId: string) {
    const injectionCallback = this.injectionCallbackByPluginId.get(pluginId);
    if (injectionCallback) {
      injectionCallback();
    }
  }

  private attachRootsFor(
    pluginId: string,
    selector: string | boolean | undefined,
    injectionCallback: () => void,
    allowBootstrap: boolean,
  ) {
    if (selector === false) {
      return this.invokeInjection(pluginId);
    }

    if (typeof selector === 'string' && selector.length) {
      const rootCandidates = queryAll(selector);
      if (rootCandidates.length) {
        const nca = this.getNearestCommonAncestor(rootCandidates);
        if (nca) {
          this.attachRootObserver(nca, pluginId, injectionCallback);
        } else {
          rootCandidates.forEach((root) =>
            this.attachRootObserver(root, pluginId, injectionCallback),
          );
        }
        return this.invokeInjection(pluginId);
      }
      if (allowBootstrap && !this.bootstrapPendingPluginIds.has(pluginId)) {
        this.bootstrapPendingPluginIds.add(pluginId);
        this.attachBootstrapObserver(
          document.documentElement,
          pluginId,
          selector,
        );
      }
      return;
    }

    this.attachRootObserver(
      document.documentElement,
      pluginId,
      injectionCallback,
    );
    this.invokeInjection(pluginId);
  }

  private preHideTargetsForReplace(config: Required<PluginConfig>) {
    if (config.injection.position !== 'replace') {
      return;
    }
    const targets = queryAll(config.injection.target).filter(isHTMLElement);
    if (!targets.length) {
      return;
    }
    const set = getOrCreateSet(this.preHiddenTargetsByPluginId, config.id);
    targets.forEach((t) => {
      try {
        // (3) Pre-hide while preserving layout; avoid flicker
        t.style.setProperty('content-visibility', 'hidden', 'important');
        set.add(t);
      } catch (err) {
        LOG.debug('preHide error', err);
      }
    });
  }

  private registerPlugin(config: Required<PluginConfig>): void {
    LOG.groupStart(`injector.setupPlugin ${config.id}`);
    this.pluginConfigById.set(config.id, config);

    // (3) As soon as we register (eligible), apply pre-hide for replace
    this.preHideTargetsForReplace(config);

    const injectionCallback = () => {
      LOG.groupStart(`injector.tryInject ${config.id}`);
      const targets = queryAll(config.injection.target);
      if (!targets.length) {
        LOG.groupEnd();
        return;
      }

      const containers: Element[] = [];
      targets.forEach((targetElement, index) => {
        const containerId = `plugin-container-${config.id}-${index}`;
        let containerElement = document.getElementById(containerId);

        if (!containerElement) {
          containerElement = document.createElement('div');
          containerElement.id = containerId;
          // Keeping display: contents to avoid layout shifts around anchors.
          // If Safari hit-testing quirks show up, consider a feature flag fallback.
          containerElement.style.display = 'contents';

          switch (config.injection.position) {
            case 'before':
              targetElement.parentNode?.insertBefore(
                containerElement,
                targetElement,
              );
              break;
            case 'after':
              targetElement.parentNode?.insertBefore(
                containerElement,
                targetElement.nextSibling,
              );
              break;
            case 'replace': {
              if (isHTMLElement(targetElement)) {
                const hiddenTargetSet = getOrCreateSet(
                  this.hiddenTargetsByPluginId,
                  config.id,
                );
                hiddenTargetSet.add(targetElement);
              }
              // Insert container before target; target will be hidden by attr when loaded.
              targetElement.parentNode?.insertBefore(
                containerElement,
                targetElement,
              );
              break;
            }
            case 'prepend':
              targetElement.insertBefore(
                containerElement,
                targetElement.firstChild,
              );
              break;
            case 'append':
            default:
              targetElement.appendChild(containerElement);
              break;
          }
        }

        containers.push(containerElement);
      });

      const previousContainers = this.containersByPluginId.get(config.id) || [];
      this.containersByPluginId.set(config.id, containers);

      containers.forEach((el) => {
        if (!previousContainers.includes(el)) {
          this.containerEvents.add(config.id, el);
        }
      });
      previousContainers.forEach((el) => {
        if (!containers.includes(el)) {
          this.containerEvents.remove(config.id, el);
        }
      });

      LOG.groupEnd();
    };

    this.injectionCallbackByPluginId.set(config.id, injectionCallback);
    this.attachRootsFor(
      config.id,
      config.injection.observerRoots,
      injectionCallback,
      true,
    );
    LOG.groupEnd();
  }
}

/** Renders a single plugin instance into a container */
interface PluginWrapperProps {
  config: Required<PluginConfig>;
}
const PluginWrapper: FC<PluginWrapperProps> = ({ config }) => {
  const { registry, ejectPlugin } = usePluginSystem();
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    LOG.groupStart(`PluginWrapper mount ${config.id}`);
    const existingComponent = registry.getPlugin(config.id);
    if (existingComponent) {
      if (isMountedRef.current) {
        setIsLoaded(true);
      }
      LOG.groupEnd();
      return;
    }
    const loadPluginComponent = async () => {
      LOG.debug(
        'loading plugin',
        config.id,
        config.remote.name,
        config.remote.module,
      );
      const component = await registry.loadPlugin(config);
      if (!isMountedRef.current) {
        return;
      }
      setIsLoaded(!!component);
    };
    void loadPluginComponent();
    return () => {
      LOG.debug('PluginWrapper unmount', config.id);
      LOG.groupEnd();
    };
  }, [config, registry]);

  useEffect(() => {
    if (isLoaded) {
      registry.markRender(config.id);
    }
  }, [isLoaded, registry, config.id]);

  // (3) Replace-mode: once loaded, assert attr hide and remove pre-hide inline style
  useEffect(() => {
    if (config.injection.position !== 'replace') {
      return;
    }
    const targets = queryAll(config.injection.target).filter(isHTMLElement);

    if (isLoaded) {
      targets.forEach((targetElement) => {
        try {
          targetElement.setAttribute('data-pluginsystem-hidden', 'true');
          // Remove temporary pre-hide inline; now global css will hide via attr.
          targetElement.style.removeProperty('content-visibility');
        } catch (err) {
          LOG.debug('apply replace hide error', err);
        }
      });
    }
  }, [isLoaded, config]);

  // Cleanup on unmount: remove attr + remove any pre-hide inline (safety)
  useEffect(() => {
    return () => {
      if (config.injection.position === 'replace') {
        const targets = queryAll(config.injection.target).filter(isHTMLElement);
        targets.forEach((targetElement) => {
          try {
            targetElement.removeAttribute('data-pluginsystem-hidden');
            targetElement.style.removeProperty('content-visibility');
          } catch (err) {
            LOG.debug('cleanup replace hide error', err);
          }
        });
      }
    };
  }, [config]);

  const PluginComponent = registry.getPlugin(config.id);
  if (!PluginComponent || !isLoaded) {
    return null;
  }

  const AnyPlugin = PluginComponent as React.ComponentType<
    Record<string, unknown>
  >;
  const pluginProps = { ...(config.props || {}) };

  return (
    <PluginErrorBoundary
      onError={(err) => {
        registry.reportRenderError(config.id, err);
        // Remove containers immediately to avoid a dead hole.
        ejectPlugin(config.id);
      }}
    >
      <AnyPlugin {...pluginProps} />
    </PluginErrorBoundary>
  );
};

/** Provider */
interface PluginSystemProviderProps {
  children: ReactNode;
}
export const PluginSystemProvider: FC<PluginSystemProviderProps> = ({
  children,
}) => {
  const config = useConfig();
  const router = useRouter();
  const [registry] = useState(() => new PluginRegistry());
  const [containersByPluginId, setContainersByPluginId] = useState<
    Map<string, Element[]>
  >(new Map());

  const pluginConfigs = useMemo<Required<PluginConfig>[]>(() => {
    const raw = (config.data as any)?.plugins;
    const list: unknown[] = Array.isArray(raw) ? raw : [];
    const normalized: Required<PluginConfig>[] = [];
    let skipped = 0;
    list.forEach((item) => {
      const n = normalizePluginConfigStrict(item);
      if (n) {
        normalized.push(n);
      } else {
        skipped += 1;
      }
    });
    if (skipped) {
      LOG.debug('plugins skipped due to invalid config', { skipped });
    }
    return normalized;
  }, [config.data]);
  const isLoading = !config.data;

  const compiledRoutePatternsByPluginId = useMemo(() => {
    const map = new Map<string, CompiledRoutes>();
    pluginConfigs.forEach((c) =>
      map.set(c.id, compileRoutes(c.visibility?.routes)),
    );
    return map;
  }, [pluginConfigs]);

  const containerEvents: ContainerEvents = useMemo(
    () => ({
      add: (pluginId, el) =>
        setContainersByPluginId((prev) => {
          const next = new Map(prev);
          const existing = (next.get(pluginId) || []).filter(
            (e) => e.isConnected,
          );
          if (!existing.includes(el)) {
            existing.push(el);
          }
          next.set(pluginId, existing);
          return next;
        }),
      remove: (pluginId, el) =>
        setContainersByPluginId((prev) => {
          const next = new Map(prev);
          const existing = next.get(pluginId);
          if (!existing) {
            return next;
          }
          const remaining = existing.filter((e) => e !== el && e.isConnected);
          if (remaining.length) {
            next.set(pluginId, remaining);
          } else {
            next.delete(pluginId);
          }
          return next;
        }),
      clear: (pluginId) =>
        setContainersByPluginId((prev) => {
          const next = new Map(prev);
          next.delete(pluginId);
          return next;
        }),
    }),
    [],
  );

  const [pluginInjector] = useState(
    () => new DOMPluginInjector(registry, containerEvents),
  );

  const routeEligiblePluginConfigs = useMemo(() => {
    const eligible = pluginConfigs.filter((c) => {
      const compiled = compiledRoutePatternsByPluginId.get(c.id) || {
        include: [],
        exclude: [],
      };
      return isRouteEligible(router.pathname, compiled);
    });
    LOG.debug(
      'routeEligiblePluginConfigs',
      router.pathname,
      eligible.map((v) => v.id),
    );
    return eligible;
  }, [pluginConfigs, router.pathname, compiledRoutePatternsByPluginId]);

  const eligiblePluginIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    LOG.groupStart('route/visibility effect');
    if (!routeEligiblePluginConfigs.length) {
      eligiblePluginIdsRef.current.forEach((pluginId) =>
        pluginInjector.stop(pluginId),
      );
      eligiblePluginIdsRef.current.clear();
      LOG.groupEnd();
      return;
    }

    // Preload early (4). Also register/warmup centralized in registry.
    routeEligiblePluginConfigs.forEach((pluginConfig) => {
      void registry
        .loadPlugin(pluginConfig)
        .catch((err) => LOG.debug('preload error', err));
    });

    const previous = eligiblePluginIdsRef.current;
    const next = new Set<string>(routeEligiblePluginConfigs.map((c) => c.id));

    next.forEach((pluginId) => {
      if (!previous.has(pluginId)) {
        const cfg = routeEligiblePluginConfigs.find((c) => c.id === pluginId);
        if (cfg) {
          pluginInjector.start([cfg]);
        }
      }
    });

    previous.forEach((pluginId) => {
      if (!next.has(pluginId)) {
        pluginInjector.stop(pluginId);
        setContainersByPluginId((prevMap) => {
          const updated = new Map(prevMap);
          updated.delete(pluginId);
          return updated;
        });
      }
    });

    eligiblePluginIdsRef.current = next;
    LOG.groupEnd();
  }, [routeEligiblePluginConfigs, pluginInjector, registry]);

  const debouncedRouteRefreshTimerId = useRef<number | null>(null);
  useEffect(() => {
    const onRouteEvent = () => {
      if (debouncedRouteRefreshTimerId.current) {
        window.clearTimeout(debouncedRouteRefreshTimerId.current);
      }
      debouncedRouteRefreshTimerId.current = window.setTimeout(() => {
        // (10) allow bootstrap retry on route change
        pluginInjector.refresh(true);
        debouncedRouteRefreshTimerId.current = null;
      }, PLUGIN_CONSTANTS.routeRefreshDebounceMs);
    };
    router.events.on('routeChangeComplete', onRouteEvent);
    router.events.on('hashChangeComplete', onRouteEvent);
    return () => {
      if (debouncedRouteRefreshTimerId.current) {
        window.clearTimeout(debouncedRouteRefreshTimerId.current);
      }
      router.events.off('routeChangeComplete', onRouteEvent);
      router.events.off('hashChangeComplete', onRouteEvent);
    };
  }, [pluginInjector, router.events]);

  useEffect(() => {
    return () => {
      LOG.debug('provider unmount; destroying injector');
      pluginInjector.destroy();
      setContainersByPluginId(new Map());
      eligiblePluginIdsRef.current.clear();
    };
  }, [pluginInjector]);

  const ejectPlugin = (pluginId: string) => {
    try {
      pluginInjector.stop(pluginId);
      setContainersByPluginId((prev) => {
        const next = new Map(prev);
        next.delete(pluginId);
        return next;
      });
      // Also make sure any future attempts re-bootstrap cleanly.
      eligiblePluginIdsRef.current.delete(pluginId);
    } catch (err) {
      LOG.debug('ejectPlugin error', err);
    }
  };

  return (
    <PluginSystemContext.Provider
      value={{ registry, pluginConfigs, isLoading, ejectPlugin }}
    >
      {children}
      {Array.from(containersByPluginId).flatMap(
        ([pluginId, containerElements]) => {
          const configForId = routeEligiblePluginConfigs.find(
            (c) => c.id === pluginId,
          );
          if (!configForId) {
            return [] as React.ReactNode[];
          }
          return containerElements
            .filter((el) => el.isConnected)
            .map((el) =>
              createPortal(
                <PluginWrapper key={el.id} config={configForId} />,
                el,
              ),
            );
        },
      )}
    </PluginSystemContext.Provider>
  );
};
