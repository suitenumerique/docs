import { useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Theme } from '@/cunningham/';
import { PostHogConf } from '@/services';

interface ConfigResponse {
  LANGUAGES: [string, string][];
  LANGUAGE_CODE: string;
  ENVIRONMENT: string;
  COLLABORATION_WS_URL?: string;
  CRISP_WEBSITE_ID?: string;
  FRONTEND_THEME?: Theme;
  FRONTEND_CSS_URL?: string;
  MEDIA_BASE_URL?: string;
  POSTHOG_KEY?: PostHogConf;
  SENTRY_DSN?: string;
  AI_FEATURE_ENABLED?: boolean;
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
  const oneHour = 1000 * 60 * 60;

  const response = useQuery<ConfigResponse, APIError, ConfigResponse>({
    queryKey: [KEY_CONFIG],
    queryFn: () => getConfig(),
    initialData: cachedData,
    staleTime: oneHour,
    initialDataUpdatedAt: Date.now() - oneHour, // Force initial data to be considered stale
  });

  return response;
}
