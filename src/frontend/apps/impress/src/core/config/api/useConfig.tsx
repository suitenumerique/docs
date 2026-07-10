import { LaGaufreV2Props } from '@gouvfr-lasuite/ui-kit';
import { useQuery } from '@tanstack/react-query';
import type { Resource } from 'i18next';
import Image from 'next/image';
import type { LinkHTMLAttributes } from 'react';

import { APIError, errorCauses, fetchAPI } from '@/api';
import type { Theme } from '@/cunningham/';
import type { FooterType } from '@/features/footer';
import { HeaderType } from '@/features/left-panel/types';
import type { PostHogConf } from '@/services/PosthogAnalytic';

type Imagetype = React.ComponentProps<typeof Image>;

interface ThemeCustomization {
  favicon?: {
    light: LinkHTMLAttributes<HTMLLinkElement>;
    dark: LinkHTMLAttributes<HTMLLinkElement>;
  };
  footer?: FooterType;
  header?: HeaderType;
  help: {
    documentation_url?: string;
    support_mailto?: string;
    legal_links?: {
      personal_data?: string;
      terms_of_use?: string;
      accessibility_statement?: string;
      legal_notice?: string;
    };
  };
  home: {
    'with-proconnect'?: boolean;
    'icon-banner'?: Imagetype;
  };
  onboarding?: {
    enabled: true;
    learn_more_url?: string;
    ready_template_url?: string;
  };
  translations?: Resource;
  waffle?: LaGaufreV2Props;
}

/**
 * Map of an allowed embed host to the iframe `sandbox` attribute to apply.
 * Record<host, sandboxAttribute>
 * Example:
 * {
 *   "excalidraw.com": "allow-scripts allow-same-origin",
 *   "www.tldraw.com": "allow-scripts allow-same-origin",
 * }
 */
export type EmbedAllowedOrigins = Record<string, string>;

export interface ConfigResponse {
  AI_BOT: { name: string; color: string };
  AI_FEATURE_ENABLED?: boolean;
  AI_FEATURE_BLOCKNOTE_ENABLED?: boolean;
  AI_FEATURE_LEGACY_ENABLED?: boolean;
  API_USERS_SEARCH_QUERY_MIN_LENGTH?: number;
  COLLABORATION_WS_URL?: string;
  COLLABORATION_WS_NOT_CONNECTED_READ_ONLY?: boolean;
  COLLABORATION_WS_INACTIVITY_TIMEOUT?: number | null;
  CONVERSION_FILE_EXTENSIONS_ALLOWED: string[];
  CONVERSION_FILE_MAX_SIZE: number;
  CONVERSION_UPLOAD_ENABLED?: boolean;
  ENVIRONMENT: string;
  FRONTEND_CSS_URL?: string;
  FRONTEND_EMBED_BLOCK_ENABLED?: boolean;
  FRONTEND_EMBED_BLOCK_ALLOWED_ORIGINS?: EmbedAllowedOrigins;
  FRONTEND_HOMEPAGE_FEATURE_ENABLED?: boolean;
  FRONTEND_JS_URL?: string;
  FRONTEND_SILENT_LOGIN_ENABLED?: boolean;
  FRONTEND_THEME?: Theme;
  LANGUAGES: [string, string][];
  LANGUAGE_CODE: string;
  MEDIA_BASE_URL?: string;
  POSTHOG_KEY?: PostHogConf['key'];
  POSTHOG_HOST?: PostHogConf['host'];
  RELEASE_VERSION: string;
  SENTRY_DSN?: string;
  REACTIONS_MAX_PER_COMMENT: number;
  TRASHBIN_CUTOFF_DAYS?: number;
  theme_customization?: ThemeCustomization;
}

const LOCAL_STORAGE_KEY = 'docs_config';

function getCachedTranslation() {
  try {
    const jsonString = localStorage.getItem(LOCAL_STORAGE_KEY);
    return jsonString ? (JSON.parse(jsonString) as ConfigResponse) : undefined;
  } catch {
    return undefined;
  }
}

function setCachedTranslation(translations: ConfigResponse) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(translations));
}

export const getConfig = async (): Promise<ConfigResponse> => {
  const response = await fetchAPI(`config/`);

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  const config = response.json() as Promise<ConfigResponse>;
  setCachedTranslation(await config);

  return config;
};

export const KEY_CONFIG = 'config';

export function useConfig() {
  const cachedData = getCachedTranslation();
  const staleTime = 1000 * 60 * 5;

  return useQuery<ConfigResponse, APIError, ConfigResponse>({
    queryKey: [KEY_CONFIG],
    queryFn: () => getConfig(),
    initialData: cachedData,
    staleTime,
    initialDataUpdatedAt: Date.now() - staleTime, // Force initial data to be considered stale
  });
}
