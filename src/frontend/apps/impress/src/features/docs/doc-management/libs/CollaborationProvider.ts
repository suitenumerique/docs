import crypto from 'crypto';

import {
  CompleteHocuspocusProviderConfiguration,
  CompleteHocuspocusProviderWebsocketConfiguration,
  HocuspocusProvider,
  HocuspocusProviderConfiguration,
  onOutgoingMessageParameters,
} from '@hocuspocus/provider';
import type { MessageEvent } from 'ws';
import * as Y from 'yjs';

import { isAPIError } from '@/api';
import { isFirefox } from '@/utils';

import { pollOutgoingMessageRequest, postPollSyncRequest } from '../api';
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

type CollaborationProviderConfiguration = HocuspocusProviderConfiguration & {
  canEdit: boolean;
};

export class CollaborationProvider extends HocuspocusProvider {
  public canEdit = false;
  public isLongPollingStarted = false;
  public isWebsocketFailed = false;
  public seemsUnsyncCount = 0;
  public seemsUnsyncMaxCount = 5;
  // Server-Sent Events
  protected sse: EventSource | null = null;
  protected url = '';
  public websocketFailureCount = 0;
  public websocketMaxFailureCount = 2;

  public constructor(configuration: CollaborationProviderConfiguration) {
    const withWS = isFirefox();
    //const withWS = true;

    let url = '';
    if (isHocuspocusProviderConfigurationUrl(configuration)) {
      url = configuration.url;
      configuration.url = !withWS ? 'ws://localhost:6666' : configuration.url;
    }

    super(configuration);

    this.url = url;
    this.canEdit = configuration.canEdit;

    if (configuration.canEdit) {
      this.on('outgoingMessage', this.onPollOutgoingMessage.bind(this));
    }

    this.configuration.websocketProvider.on(
      'connect',
      this.onWebsocketConnect.bind(this),
    );
  }

  public setPollDefaultValues(): void {
    this.isLongPollingStarted = false;
    this.isWebsocketFailed = false;
    this.seemsUnsyncCount = 0;
    this.sse?.close();
    this.sse = null;
    this.websocketFailureCount = 0;
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
        void this.pollSync(true);
        this.initCollaborationSSE();
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
    if (!this.isWebsocketFailed || !this.canEdit) {
      return;
    }

    //console.log('outgoingMessage', message.description);

    try {
      const { updated } = await pollOutgoingMessageRequest({
        pollUrl: this.toPollUrl('message'),
        message64: Buffer.from(message.toUint8Array()).toString('base64'),
      });

      if (!updated) {
        console.error('Message not updated');
        await this.pollSync();
      }
    } catch (error: unknown) {
      if (isAPIError(error)) {
        // The user is not allowed to send messages
        if (error.status === 403) {
          this.off('outgoingMessage', this.onPollOutgoingMessage.bind(this));
          this.canEdit = false;
        }
      }

      console.error('Polling message failed:', error);
    }
  }

  protected initCollaborationSSE() {
    if (!this.isWebsocketFailed) {
      return;
    }

    console.log('initCollaborationSSE');

    this.sse = new EventSource(this.toPollUrl('message'), {
      withCredentials: true,
    });

    this.sse.onmessage = (event) => {
      const { updatedDoc64, stateFingerprint, awareness64 } = JSON.parse(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        event.data,
      ) as {
        updatedDoc64?: string;
        stateFingerprint?: string;
        awareness64?: string;
      };
      console.log('Received SSE event:', event.data);

      if (awareness64) {
        const awareness = Buffer.from(awareness64, 'base64');

        this.onMessage({
          data: awareness,
        } as MessageEvent);
      }

      if (updatedDoc64) {
        const uint8Array = Buffer.from(updatedDoc64, 'base64');
        Y.applyUpdate(this.document, uint8Array);
      }

      const localStateFingerprint = this.getStateFingerprint(this.document);
      console.log('EQUAL AWA', localStateFingerprint === stateFingerprint);
      if (localStateFingerprint !== stateFingerprint) {
        void this.pollSync();
      } else {
        this.seemsUnsyncCount = 0;
      }
    };

    this.sse.onopen = () => {
      console.log('SSE connection opened.');
    };

    // 3. onerror is triggered if there's a connection issue
    this.sse.onerror = (err) => {
      console.error('SSE error:', err);
    };
  }

  /**
   * Sync the document with the server.
   *
   * In some rare cases, the document may be out of sync.
   * We use a fingerprint to compare documents,
   * it happens that the local fingerprint is different from the server one
   * when awareness plus the document are updated quickly.
   * The system is resilient to this kind of problems, so `seemsUnsyncCount` should
   * go back to 0 after a few seconds. If not, we will force a sync.
   */
  public async pollSync(forseSync = false) {
    if (!this.isWebsocketFailed) {
      return;
    }

    this.seemsUnsyncCount++;

    if (this.seemsUnsyncCount < this.seemsUnsyncMaxCount && !forseSync) {
      return;
    }

    console.log('Syncing');

    try {
      const { syncDoc64 } = await postPollSyncRequest({
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
}
