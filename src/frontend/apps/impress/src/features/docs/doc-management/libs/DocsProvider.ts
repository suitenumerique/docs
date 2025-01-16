/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';

import {
  CompleteHocuspocusProviderConfiguration,
  CompleteHocuspocusProviderWebsocketConfiguration,
  HocuspocusProvider,
  HocuspocusProviderConfiguration,
  onOutgoingMessageParameters,
} from '@hocuspocus/provider';
import * as time from 'lib0/time';
import * as Y from 'yjs';

import { isFirefox } from '@/utils';

import { toBase64 } from '../utils';

type HocuspocusProviderConfigurationUrl = Required<
  Pick<CompleteHocuspocusProviderConfiguration, 'name'>
> &
  Partial<CompleteHocuspocusProviderConfiguration> &
  Required<Pick<CompleteHocuspocusProviderWebsocketConfiguration, 'url'>>;

export const isHocuspocusProviderConfigurationUrl = (
  data: HocuspocusProviderConfiguration,
): data is HocuspocusProviderConfigurationUrl => {
  return 'url' in data;
};

export class DocsProvider extends HocuspocusProvider {
  private websocketFailureCount = 0;
  private websocketMaxFailureCount = 2;
  private isWebsocketFailed = false;
  private isLongPollingStarted = false;
  private url = '';

  public constructor(configuration: HocuspocusProviderConfiguration) {
    const withWS = isFirefox();

    let url = '';
    if (isHocuspocusProviderConfigurationUrl(configuration)) {
      url = configuration.url;
      configuration.url = !withWS ? 'ws://localhost:6666' : configuration.url;
    }

    super(configuration);

    this.url = url;

    this.on('outgoingMessage', this.onPollOutgoingMessage.bind(this));
    this.configuration.websocketProvider.on(
      'connect',
      this.onWebsocketConnect.bind(this),
    );
  }

  public setPollDefaultValues(): void {
    this.websocketFailureCount = 0;
    this.isWebsocketFailed = false;
    this.isLongPollingStarted = false;
  }

  public destroy(): void {
    super.destroy();
    this.setPollDefaultValues();
  }

  public onWebsocketConnect = () => {
    this.setPollDefaultValues();
  };

  public onClose(): void {
    this.isAuthenticated = false;
    this.synced = false;

    this.websocketFailureCount += 1;

    console.log('onClose', this.websocketFailureCount);

    if (
      !this.isWebsocketFailed &&
      this.websocketFailureCount > this.websocketMaxFailureCount
    ) {
      this.isWebsocketFailed = true;

      if (!this.isLongPollingStarted) {
        this.isLongPollingStarted = true;
        void this.pollSync();
        void this.longPollAwareness();
        void this.longPollDocUpdate();
      }
    }
  }

  protected toPollUrl(endpoint: string): string {
    let pollUrl = this.url.replace('ws:', 'http:');
    if (pollUrl.includes('wss:')) {
      pollUrl = pollUrl.replace('wss:', 'https:');
    }

    pollUrl = pollUrl.replace('/ws/', '/ws/poll/' + endpoint + '/');

    // To have our requests not cached
    return `${pollUrl}&${Date.now()}`;
  }

  public async onPollOutgoingMessage({ message }: onOutgoingMessageParameters) {
    if (!this.isWebsocketFailed) {
      return;
    }

    //console.log('outgoingMessage', message.description);

    const { updated } = await postPollMessageRequest({
      pollUrl: this.toPollUrl('message'),
      message64: Buffer.from(message.toUint8Array()).toString('base64'),
    });

    if (!updated) {
      console.error('Message not updated');
      await this.pollSync();
    }
  }

  protected async longPollDocUpdate() {
    if (!this.isWebsocketFailed) {
      return;
    }

    console.log('startPollDoc');
    let waitMs = 0;

    try {
      const { updatedDoc64, stateFingerprint } =
        await pollRequest<GetPollDocResponse>({
          pollUrl: this.toPollUrl('doc'),
        });

      console.log('updatedDoc64', updatedDoc64);

      if (updatedDoc64) {
        const uint8Array = Buffer.from(updatedDoc64, 'base64');
        Y.applyUpdate(this.document, uint8Array);

        const localStateFingerprint = this.getStateFingerprint(this.document);
        console.log('stateFingerprint', stateFingerprint);
        console.log('localStateFingerprint', localStateFingerprint);
        console.log('EQUAL', localStateFingerprint === stateFingerprint);

        if (localStateFingerprint !== stateFingerprint) {
          await this.pollSync();
        }
      }
    } catch (error) {
      console.error('Polling doc failed:', error);
      // Could be no internet connection
      waitMs = 5000;
    } finally {
      console.log('endPollDoc');

      setTimeout(() => {
        void this.longPollDocUpdate();
      }, waitMs);
    }
  }

  protected async longPollAwareness() {
    if (!this.isWebsocketFailed) {
      return;
    }

    console.log('startPollAwareness');
    let waitMs = 0;
    try {
      const { awareness } = await pollRequest<GetPollAwarenessResponse>({
        pollUrl: this.toPollUrl('awareness'),
      });

      console.log('awareness', awareness);

      if (awareness) {
        Object.entries(awareness).forEach(
          ([clientAwarenessKeyStr, clientAwareness]) =>
            this.setAwareness(Number(clientAwarenessKeyStr), clientAwareness),
        );
      }
    } catch (error) {
      console.error('Polling awareness failed:', error);
      // Could be no internet connection
      waitMs = 5000;
    } finally {
      setTimeout(() => {
        void this.longPollAwareness();
      }, waitMs);
    }
  }

  public async pollSync() {
    if (!this.isWebsocketFailed) {
      return;
    }

    console.log('Syncing');

    try {
      const { syncDoc64 } = await pollSyncRequest({
        pollUrl: this.toPollUrl('sync'),
        localDoc64: toBase64(Y.encodeStateAsUpdate(this.document)),
      });

      if (syncDoc64) {
        const uint8Array = Buffer.from(syncDoc64, 'base64');
        Y.applyUpdate(this.document, uint8Array);
      }
    } catch (error) {
      console.error('Polling sync failed:', error);
    }
  }

  /**
   * Create a hash SHA-256 of the state vector of the document.
   * Usefull to compare the state of the document.
   * @param doc
   * @returns
   */
  public getStateFingerprint(doc: Y.Doc): string {
    const stateVector = Y.encodeStateVector(doc);
    return crypto.createHash('sha256').update(stateVector).digest('base64');
  }

  public setAwareness(
    awarenessKey: number,
    awarenessValue: Record<string, unknown>,
  ): void {
    this.awareness?.states.set(awarenessKey, awarenessValue);
    const currLocalMeta = this.awareness?.meta.get(awarenessKey);
    const clock = currLocalMeta === undefined ? 0 : currLocalMeta.clock + 1;
    this.awareness?.meta.set(awarenessKey, {
      clock,
      lastUpdated: time.getUnixTime(),
    });
  }
}

interface PostPollMessageParams {
  pollUrl: string;
  message64: string;
}
interface PostPollMessageResponse {
  updated?: boolean;
}

export const postPollMessageRequest = async ({
  pollUrl,
  message64,
}: PostPollMessageParams): Promise<PostPollMessageResponse> => {
  const response = await fetch(pollUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message64,
    }),
  });

  return response.json() as Promise<PostPollMessageResponse>;
};

interface GetPollAwarenessResponse {
  awareness?: Record<string, Record<string, unknown>>;
}

interface GetPollDocResponse {
  updatedDoc64?: string;
  stateFingerprint?: string;
}

interface PollParams {
  pollUrl: string;
}
export const pollRequest = async <Response>({
  pollUrl,
}: PollParams): Promise<Response> => {
  const response = await fetch(pollUrl, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json() as Promise<Response>;
};

interface PollSyncParams {
  pollUrl: string;
  localDoc64: string;
}
interface PollSyncResponse {
  syncDoc64?: string;
}

export const pollSyncRequest = async ({
  pollUrl,
  localDoc64,
}: PollSyncParams): Promise<PollSyncResponse> => {
  const response = await fetch(pollUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      localDoc64,
    }),
  });

  return response.json() as Promise<PollSyncResponse>;
};
