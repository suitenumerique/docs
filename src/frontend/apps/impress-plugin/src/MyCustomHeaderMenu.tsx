import './MyCustomHeaderMenu.css';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Popover } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { useAuthQuery } from 'impress/features/auth/api';
import { Icon, Loading } from 'impress/components';

interface NavigationCategory {
  identifier: string;
  display_name: string;
  entries: NavigationEntry[];
}

interface NavigationEntry {
  identifier: string;
  link: string;
  target: string;
  display_name: string;
  icon_url: string;
}

const StyledPopover = styled(Popover)`
  background-color: white;
  border-radius: 4px;
  box-shadow: 1px 1px 5px rgba(0, 0, 0, 0.1);
  border: 1px solid #dddddd;
  transition: opacity 0.2s ease-in-out;
`;

const StyledButton = styled(Button)`
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
  transition: all 0.2s ease-in-out;
  font-family: Marianne, Arial, serif;
  font-weight: 500;
  font-size: 0.938rem;
  padding: 0;
  text-wrap: nowrap;
`;

// Fake navigation response for development/debugging
const fakeNavigationData = {
  categories: [
    {
      identifier: 'fake-cat',
      display_name: 'Dummy Category',
      entries: [
        {
          identifier: 'fake-entry-1',
          link: 'https://www.google.com',
          target: '_blank',
          display_name: 'Google',
          icon_url: 'https://placehold.co/24',
        },
        {
          identifier: 'fake-entry-2',
          link: 'https://www.example.com',
          target: '_blank',
          display_name: 'Example',
          icon_url: 'https://placehold.co/24',
        },
      ],
    },
  ],
};

const formatLanguage = (language: string): string => {
  const [lang, region] = language.split('-');
  return region
    ? `${lang}-${lang.toUpperCase()}`
    : `${language}-${language.toUpperCase()}`;
};

const fetchNavigation = async (
  language: string,
  baseUrl: string,
): Promise<NavigationCategory[] | null> => {
  // Uncomment below for development/debugging with fake data
  return fakeNavigationData.categories;

  try {
    if (!baseUrl) {
      console.warn('[CentralMenu] ICS_BASE_URL not configured');
      return null;
    }

    const response = await fetch(
      `${baseUrl}/navigation.json?language=${language}`,
      {
        method: 'GET',
        credentials: 'include',
        redirect: 'follow',
      },
    );

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const jsonData = await response.json() as Record<string, unknown>;
        
        if (
          jsonData &&
          typeof jsonData === 'object' &&
          'categories' in jsonData &&
          Array.isArray(jsonData.categories)
        ) {
          return jsonData.categories as NavigationCategory[];
        } else {
          console.warn('[CentralMenu] Invalid JSON format in navigation response.');
          return null;
        }
      } else {
        console.warn('[CentralMenu] Unexpected content type:', contentType);
        return null;
      }
    } else {
      console.warn('[CentralMenu] Navigation fetch failed. Status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('[CentralMenu] Error fetching navigation:', error);
    return null;
  }
};

interface CentralMenuProps {
  icsBaseUrl?: string;
  portalBaseUrl?: string;
}

const CentralMenu: React.FC<CentralMenuProps> = ({
  icsBaseUrl = '',
  portalBaseUrl = '',
}) => {
  const { i18n, t } = useTranslation();
  const { data: auth } = useAuthQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [navigation, setNavigation] = useState<NavigationCategory[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleIframeLoad = async () => {
    const language = i18n.language ? formatLanguage(i18n.language) : 'en-US';
    const navData = await fetchNavigation(language, icsBaseUrl);

    if (navData) {
      setNavigation(navData);
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  // Handle language changes - refetch navigation when language changes
  useEffect(() => {
    // Only refetch if iframe has already loaded (navigation exists or error occurred)
    if (status !== 'loading') {
      handleIframeLoad();
    }
  }, [i18n.language]);

  if (!auth?.id) {
    return null;
  }

  const renderNavigation = () => {
    if (!navigation) {
      return null;
    }

    return navigation.map((category) => (
      <li
        key={category.identifier}
        data-testid="od-menu-app-category"
      >
        <span className="menu-category">{category.display_name}</span>
        <ul className="menu-entries" data-testid="od-menu-apps">
          {category.entries.map((entry) => (
            <li key={entry.identifier} data-testid="od-menu-app">
              <a
                href={entry.link}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                target={entry.target}
                className="menu-link"
                role="menuitem"
              >
                <img
                  alt={entry.display_name}
                  src={entry.icon_url}
                  className="menu-icon"
                  width={24}
                  height={24}
                />
                <span>{entry.display_name}</span>
              </a>
            </li>
          ))}
        </ul>
      </li>
    ));
  };

  return (
    <>
      {icsBaseUrl && (
        <iframe
          ref={iframeRef}
          title="opendesk login"
          src={`${icsBaseUrl}/silent`}
          data-testid="od-menu-iframe"
          hidden
          onLoad={handleIframeLoad}
          style={{ display: 'none', visibility: 'hidden' }}
        />
      )}
      <nav id="central-menu" role="navigation" aria-label="Main Navigation">
        <StyledButton
          id="nav-button"
          className={isOpen ? 'active' : ''}
          ref={triggerRef}
          onPress={handleToggle}
          aria-label="Toggle Central Menu"
          aria-expanded={isOpen}
          aria-controls="nav-content"
          data-testid="od-menu-open-button"
        >
          <Icon iconName="apps" aria-hidden="true" />
        </StyledButton>
        <StyledPopover
          triggerRef={triggerRef}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          offset={0}
          containerPadding={0}
          data-testid="od-menu-popover"
        >
          <div id="nav-content">
            <ul className="menu-list">
              {status === 'error' ? (
                <li className="menu-category" data-testid="od-menu-app-category">
                  <small>
                    {t('Navigation could not be accessed.')}
                    {portalBaseUrl && (
                      <>
                        <br />
                        <a
                          href={portalBaseUrl}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('Try logging out and logging in again.')}
                        </a>
                      </>
                    )}
                  </small>
                </li>
              ) : status === 'loading' ? (
                <li className="menu-category" data-testid="od-menu-app-category">
                  <Loading />
                </li>
              ) : (
                renderNavigation()
              )}
            </ul>
          </div>
        </StyledPopover>
      </nav>
    </>
  );
};

export default CentralMenu;