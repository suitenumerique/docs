/**
 * Configure Crisp chat for real-time support across all pages.
 */

import { Crisp } from 'crisp-sdk-web';
import { PropsWithChildren, useEffect, useState } from 'react';
import { createGlobalStyle } from 'styled-components';

import { User } from '@/features/auth';

const CrispStyle = createGlobalStyle`
  #crisp-chatbox a{
    zoom: 0.8;
  }

  @media screen and (width <= 1024px) {
    .c__modals--opened #crisp-chatbox {
      display: none!important;
    }
  }
`;

export const initializeCrispSession = (user: User) => {
  if (!Crisp.isCrispInjected()) {
    return;
  }
  Crisp.setTokenId(`impress-${user.id}`);
  Crisp.user.setEmail(user.email);
};

export const configureCrispSession = (websiteId: string) => {
  if (Crisp.isCrispInjected()) {
    return;
  }
  Crisp.configure(websiteId);
  Crisp.setSafeMode(true);
};

export const terminateCrispSession = () => {
  if (!Crisp.isCrispInjected()) {
    return;
  }
  Crisp.setTokenId();
  Crisp.session.reset();
};

interface CrispProviderProps {
  websiteId?: string;
}

export const CrispProvider = ({
  children,
  websiteId,
}: PropsWithChildren<CrispProviderProps>) => {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (!websiteId) {
      return;
    }

    setIsConfigured(true);
    configureCrispSession(websiteId);
  }, [websiteId]);

  return (
    <>
      {isConfigured && <CrispStyle />}
      {children}
    </>
  );
};
