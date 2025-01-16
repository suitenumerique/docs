import { readAuthMessage } from '@hocuspocus/common';
import { HocuspocusProvider, MessageType } from '@hocuspocus/provider';
import { readVarInt, readVarString } from 'lib0/decoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import { messageYjsSyncStep2, readSyncMessage } from 'y-protocols/sync';
import * as Y from 'yjs';

import { IncomingMessage } from './IncomingMessage';
import { OutgoingMessage } from './OutgoingMessage';

export class MessageReceiver {
  message: IncomingMessage;

  broadcasted = false;

  constructor(message: IncomingMessage) {
    this.message = message;
  }

  public setBroadcasted(value: boolean) {
    this.broadcasted = value;

    return this;
  }

  public apply(provider: HocuspocusProvider, emitSynced: boolean) {
    const { message } = this;
    const type = message.readVarUint();
    const emptyMessageLength = message.length();

    console.log('MessageReceiver.type', type);

    switch (type) {
      case MessageType.Sync:
        this.applySyncMessage(provider, emitSynced);
        break;

      case MessageType.Awareness:
        this.applyAwarenessMessage(provider);
        break;

      case MessageType.Auth:
        this.applyAuthMessage(provider);
        break;

      case MessageType.QueryAwareness:
        this.applyQueryAwarenessMessage(provider);
        break;

      case MessageType.Stateless:
        provider.receiveStateless(readVarString(message.decoder));
        break;

      case MessageType.SyncStatus:
        this.applySyncStatusMessage(
          provider,
          readVarInt(message.decoder) === 1,
        );
        break;
      default:
        //Y.applyUpdate(provider.document, message.readVarUint8Array());
        throw new Error(`Can’t apply message of unknown type: ${type}`);
    }

    // Reply
    if (message.length() > emptyMessageLength + 1) {
      // length of documentName (considered in emptyMessageLength plus length of yjs sync type, set in applySyncMessage)
      if (this.broadcasted) {
        // TODO: Some weird TypeScript error
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        provider.broadcast(OutgoingMessage, { encoder: message.encoder });
      } else {
        // TODO: Some weird TypeScript error
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        provider.send(OutgoingMessage, { encoder: message.encoder });
      }
    }
  }

  private applySyncMessage(provider: HocuspocusProvider, emitSynced: boolean) {
    const { message } = this;

    message.writeVarUint(MessageType.Sync);

    // Apply update
    const syncMessageType = readSyncMessage(
      message.decoder,
      message.encoder,
      provider.document,
      provider,
    );

    // Synced once we receive Step2
    if (emitSynced && syncMessageType === messageYjsSyncStep2) {
      provider.synced = true;
    }
  }

  applySyncStatusMessage(provider: HocuspocusProvider, applied: boolean) {
    if (applied) {
      provider.decrementUnsyncedChanges();
    }
  }

  private applyAwarenessMessage(provider: HocuspocusProvider) {
    if (!provider.awareness) {
      return;
    }

    const { message } = this;

    awarenessProtocol.applyAwarenessUpdate(
      provider.awareness,
      message.readVarUint8Array(),
      provider,
    );
  }

  private applyAuthMessage(provider: HocuspocusProvider) {
    const { message } = this;

    readAuthMessage(
      message.decoder,
      provider.permissionDeniedHandler.bind(provider),
      provider.authenticatedHandler.bind(provider),
    );
  }

  private applyQueryAwarenessMessage(provider: HocuspocusProvider) {
    if (!provider.awareness) {
      return;
    }

    const { message } = this;

    message.writeVarUint(MessageType.Awareness);
    message.writeVarUint8Array(
      awarenessProtocol.encodeAwarenessUpdate(
        provider.awareness,
        Array.from(provider.awareness.getStates().keys()),
      ),
    );
  }
}
