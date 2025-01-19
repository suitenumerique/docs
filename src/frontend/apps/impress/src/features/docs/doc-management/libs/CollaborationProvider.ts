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

export class CollaborationProvider extends HocuspocusProvider {
  private websocketFailureCount = 0;
  private websocketMaxFailureCount = 2;
  private isWebsocketFailed = false;
  private isLongPollingStarted = false;
  private url = '';
  public static TIMEOUT = 30000;
  // Server-Sent Events
  private sse: EventSource | null = null;

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
    this.sse?.close();
    this.sse = null;
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
        this.initCollaborationSSE();
        //void this.longPollAwareness();
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

    const { updated } = await pollOutgoingMessageRequest({
      pollUrl: this.toPollUrl('message'),
      message64: Buffer.from(message.toUint8Array()).toString('base64'),
    });

    if (!updated) {
      console.error('Message not updated');
      await this.pollSync();
    }
  }

  protected initCollaborationSSE() {
    if (!this.isWebsocketFailed) {
      return;
    }

    console.log('initCollaborationSSE');

    const eventSource = new EventSource(this.toPollUrl('message'), {
      withCredentials: true,
    });

    // 1. onmessage handles messages sent with `data:` lines
    eventSource.onmessage = async (event) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
      const { updatedDoc64, stateFingerprint, awareness64 } = JSON.parse(
        event.data,
      ) as {
        updatedDoc64: string;
        stateFingerprint: string;
        awareness64: string;
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

        const localStateFingerprint = this.getStateFingerprint(this.document);
        console.log('stateFingerprint', stateFingerprint);
        console.log('localStateFingerprint', localStateFingerprint);
        console.log('EQUAL', localStateFingerprint === stateFingerprint);

        if (localStateFingerprint !== stateFingerprint) {
          await this.pollSync();
        }
      }
    };

    // 2. onopen is triggered when the connection is first established
    eventSource.onopen = () => {
      console.log('SSE connection opened.');
    };

    // 3. onerror is triggered if there's a connection issue
    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      // Depending on the error, the browser may or may not automatically reconnect
    };

    //console.log('initCollaborationSSE:data', data);
  }

  public onMessage(event: MessageEvent) {
    super.onMessage(event);

    console.log('onMessage', event);
    console.log('isSynced', this.isSynced);
    console.log('unsyncedChanges', this.unsyncedChanges);

    // if (this.hasUnsyncedChanges) {
    //   this.unsyncedChanges = 0;
    //   void this.pollSync();
    // }
  }

  public async pollSync() {
    if (!this.isWebsocketFailed) {
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
        this.synced = true;
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
