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
  MEDIA_BASE_URL?: string;
  POSTHOG_KEY?: PostHogConf;
  SENTRY_DSN?: string;
}

export const getConfig = async (): Promise<ConfigResponse> => {
  const response = await fetchAPI(`config/`);

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  return response.json() as Promise<ConfigResponse>;
};

export const KEY_CONFIG = 'config';

export function useConfig() {
  return useQuery<ConfigResponse, APIError, ConfigResponse>({
    queryKey: [KEY_CONFIG],
    queryFn: () => getConfig(),
    staleTime: Infinity,
  });
}
