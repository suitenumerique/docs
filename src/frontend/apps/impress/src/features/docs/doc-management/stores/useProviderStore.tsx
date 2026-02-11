import { CloseEvent } from '@hocuspocus/common';
import {
  ConstructableOutgoingMessage,
  HocuspocusProvider,
  MessageType,
  OutgoingMessageArguments,
  WebSocketStatus,
} from '@hocuspocus/provider';
// import { messageSync, WebsocketProvider } from 'y-websocket';
import { messageSync, WebsocketProvider } from './y-websocket.cjs';
// import { MessageSender } from '@hocuspocus/provider/src/MessageSender';
// import {
//   MessageSender
// } from '@hocuspocus/provider/default';
import { fromUint8Array, toUint8Array } from 'js-base64';
import * as decoding from 'lib0/decoding';
// import { WebSocket } from 'ws';
import type { Data, MessageEvent } from 'ws';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/docs/doc-management';
import { IncomingMessage } from '@/docs/doc-management/stores/IncomingMessage';
import { ClientRequestArgs } from 'node:http';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDoc?: Base64,
  ) => WebsocketProvider;
  // ) => HocuspocusProvider;
  destroyProvider: () => void;
  // provider: HocuspocusProvider | undefined;
  provider: WebsocketProvider | undefined;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
};

type ExtendedCloseEvent = CloseEvent & { wasClean: boolean };

function encrypt(data: Uint8Array): Uint8Array {
  console.log(888888);
  console.warn('ENCRYPTING');
  console.warn('ENCRYPTING');

  // return data;
  // return new TextEncoder().encode(data);

  const key = 42;
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) encrypted[i] = data[i] ^ key;
  return encrypted;
}

function decrypt(data: Uint8Array): Uint8Array {
  console.log(9999);
  console.warn('DECRYPTING');

  // return data;
  // return new TextDecoder().decode(data);

  const key = 42;
  const decrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) decrypted[i] = data[i] ^ key;
  return decrypted;
}

class EncryptedWebSocket extends WebSocket {
  constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols);

    const originalAddEventListener = this.addEventListener.bind(this);

    this.addEventListener = function <K extends keyof WebSocketEventMap>(
      type: K,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'message') {
        const wrappedListener: typeof listener = (event) => {
          const messageEvent = event as any;

          console.warn('-------');
          console.log(messageEvent.data instanceof Uint8Array); // true/false
          console.log(messageEvent.data instanceof ArrayBuffer); // true/false
          console.log(messageEvent.data instanceof Blob); // true/false
          console.warn('-------');
          if (!(messageEvent.data instanceof ArrayBuffer)) {
            throw new Error(
              `the data over the wire should always be ArrayBuffer since defined on the websocket property "binaryType"`,
            );
          }

          const manageableData = new Uint8Array(messageEvent.data);
          const decryptedData = decrypt(manageableData);

          console.error('--------');
          console.error('WRAPPER WORKING');

          if (typeof listener === 'function') {
            listener.call(this, { ...event, data: decryptedData });
          } else {
            listener.handleEvent.call(this, {
              ...event,
              data: decryptedData,
            });
          }
        };

        originalAddEventListener('message', wrappedListener, options);
      } else {
        originalAddEventListener(type, listener, options);
      }
    };

    // In case it's added directly with `onmessage` and since we cannot override the setter of `onmessage`
    // tweak a bit to intercept when setting it
    // const base = Object.getPrototypeOf(this) as WebSocket;
    // const baseDesc = Object.getOwnPropertyDescriptor(base, 'onmessage')!;

    let explicitlySetListener:
      | ((this: WebSocket, handlerEvent: MessageEvent) => any)
      | null;
    null;

    Object.defineProperty(this, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        console.log('GETTING ONMESSAGE');

        return explicitlySetListener;
      },
      set(handler: ((handlerEvent: MessageEvent) => any) | null) {
        explicitlySetListener = null;

        throw new Error(
          `"onmessage" should not be set by "y-websocket", instead it should be patched to use "addEventListener" since we want to extend it to decrypt messages but "defineProperty" is not working on the instance, probably it should be done on the prototype but it would mess with other WebSocket usage`,
        );

        // if (!handler) {
        //   explicitlySetListener = null;
        //   return;
        // }

        // explicitlySetListener = function (
        //   this: WebSocket,
        //   event: MessageEvent,
        // ) {
        //   if (!(event.data instanceof ArrayBuffer)) {
        //     throw new Error(
        //       `the data over the wire should always be ArrayBuffer since defined on the websocket property "binaryType"`,
        //     );
        //   }

        //   const manageableData = new Uint8Array(event.data);

        //   return handler.call(this, { ...event, data: decrypt(manageableData) });
        // };
      },
    });
  }

  send(message: Uint8Array) {
    console.log(5555);
    console.warn('SEND');

    return super.send(encrypt(message));
  }
}

class CustomProvider extends WebsocketProvider {}

// class CustomProvider extends HocuspocusProvider {
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   send(
//     message: ConstructableOutgoingMessage,
//     args: Partial<OutgoingMessageArguments>,
//   ) {
//     // if (!this._isAttached) return;
//     // const messageSender = new MessageSender(message, args);
//     // this.emit('outgoingMessage', { message: messageSender.message });
//     // messageSender.send(this.configuration.websocketProvider);

//     console.log('-----');
//     if (message.name === 'UpdateMessage') {
//       console.log(8888);
//       console.log(args.update);
//       if (args.update) {
//         console.log('.......');
//         console.log(typeof args.update);
//         console.log('.......');

//         // const base64EncodedUpdateAsString = fromUint8Array(args.update);

//         // const encoder = new TextEncoder();
//         // const base64EncodedUpdateAsUint8Array = encoder.encode(
//         //   base64EncodedUpdateAsString,
//         // );

//         // args.update = base64EncodedUpdateAsUint8Array;

//         const decodedUpdate = Y.decodeUpdate(args.update);

//         for (const struct of decodedUpdate.structs) {
//           if (struct instanceof Y.Item) {
//             if (struct.content instanceof Y.ContentString) {
//               console.log('----');
//               console.log(struct.content.str);
//               console.log(struct.content.getContent());
//               console.log(struct.content.getRef());
//             }

//             // TODO: check for other Y.ContentXXXX...? Maybe it could be image binary or something else
//             // ... is it enough to encrypt only this and not the whole "update"? So the server can read it if needed

//             // console.log('----');
//             // console.log(struct);
//           }
//         }

//         // Y.write;

//         //       const doc = new Y.Doc();
//         // Y.applyUpdate(doc, args.update);
//         // const result = doc.toJSON();

//         // const decoder = decoding.createDecoder(args.update);
//         // const result = decoding.readVarString(decoder);

//         // console.log(fromUint8Array(args.update));
//         // console.log(result);
//       }
//     } else {
//       // console.log(777777);
//       // console.log(message.name);
//       // console.log(args);
//     }

//     // const msg = new message();
//     // msg.get(args);

//     // msg.

//     console.log('-----');

//     super.send(message, args);
//   }

//   // onMessage(event: MessageEvent) {
//   //   // const message = new IncomingMessage(event.data);
//   //   // const documentName = message.readVarString();
//   //   // message.writeVarString(documentName);
//   //   // this.emit('message', { event, message: new IncomingMessage(event.data) });
//   //   // new MessageReceiver(message).apply(this, true);

//   //   const message = new IncomingMessage(event.data);

//   //   const type = message.readVarUint();

//   //   if (type === MessageType.Sync) {
//   //     console.warn('THOMAS');

//   //     const base64EncodedUpdateAsUint8Array = event.data as Uint8Array;

//   //     const decoder = new TextDecoder();
//   //     const base64EncodedUpdateAsString = decoder.decode(
//   //       base64EncodedUpdateAsUint8Array,
//   //     );

//   //     event.data = toUint8Array(base64EncodedUpdateAsString) as Data;
//   //   }

//   //   // this.emit('message', { event, message: new IncomingMessage(event.data) });
//   //   // new MessageReceiver(message).apply(this, true);

//   //   console.log('-----');
//   //   console.log(99999);
//   //   console.log(event);

//   //   super.onMessage(event);
//   // }
// }

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDoc) => {
    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDoc) {
      Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
    }

    //
    // TODO: should implement features for authentication (listening on message with custom payload?)
    // same for previous "onSynced"
    //

    const provider = new CustomProvider(wsUrl, storeId, doc, {
      WebSocketPolyfill: EncryptedWebSocket,
      // For simplicity we always use websocket server even if there is local tabs,
      // otherwise the question would be do we need to encrypt also for local tabs through BroadcastChannel or not
      disableBc: true,
    });

    // // To avoid hardcoding the whole provider for overrides, we just patch the needed methods (they cannot be extended)
    // const originalUpdateHandler = provider._updateHandler.bind(provider);

    console.warn('CUSTOM PROVIDER SET UP');
    console.warn('CUSTOM PROVIDER SET UP');
    console.warn('CUSTOM PROVIDER SET UP');

    // TODO:
    // TODO:
    // TODO:
    // TODO: provider._updateHandler is not used... why?
    // TODO:
    // TODO: ===> il faut override .send() :/ donc hardcoder ou pas ?
    // TODO:

    // xxx;

    // WebSocketPolyfill; // ===> can be augmented directly, by default "WebSocket"
    // but it should not encrypt things about authentication that needs to be checked by the server?
    // but this should be done on headers when establishing the connection, no? so no care about content being encrypted

    // provider._updateHandler = (update, origin) => {
    //   console.warn('LOOOOL');

    //   if (origin !== provider) {
    //     console.warn('---');
    //     console.warn('UP');
    //     console.warn(update);

    //     const base64EncodedUpdateAsString = fromUint8Array(update);

    //     const encoder = new TextEncoder();
    //     const base64EncodedUpdateAsUint8Array = encoder.encode(
    //       base64EncodedUpdateAsString,
    //     );

    //     const encryptedUpdate = base64EncodedUpdateAsUint8Array;

    //     originalUpdateHandler(encryptedUpdate, origin);
    //   }
    // };

    // TODO:
    // TODO:
    // TODO: override onmessage for websocket... more complicated since on setupWS
    // TODO: maybe it should be hardcoded since we will have to add logic about userId & so on for authentication? (maybe we can hack this too by extending?)
    // TODO:

    // const originalSyncMessageHandler =
    //   provider.messageHandlers[messageSync].bind(provider);

    // provider.messageHandlers[messageSync] = (
    //   encoder,
    //   decoder,
    //   provider,
    //   emitSynced,
    //   _messageType,
    // ) => {
    //   const base64EncodedUpdateAsUint8Array =
    //     decoding.readVarUint8Array(decoder);

    //   const newDecoder = decoding.createDecoder(
    //     base64EncodedUpdateAsUint8Array,
    //   );

    //   // console.warn('---');
    //   // console.warn('DOWN');
    //   // console.warn(base64EncodedUpdateAsUint8Array);

    //   // const tmpDecoder = new TextDecoder();
    //   // const base64EncodedUpdateAsString = tmpDecoder.decode(
    //   //   base64EncodedUpdateAsUint8Array,
    //   // );

    //   // const updateAsUint8Array = toUint8Array(base64EncodedUpdateAsString);

    //   // console.warn('---');
    //   // console.warn('DOWN DECODED');
    //   // console.warn(updateAsUint8Array);

    //   // // New decoder for the original function to work properly
    //   // const newDecoder = decoding.createDecoder(updateAsUint8Array);

    //   // TODO:
    //   // TODO: do I need to modify the encoder?
    //   // TODO:

    //   originalSyncMessageHandler(
    //     encoder,
    //     newDecoder,
    //     provider,
    //     emitSynced,
    //     _messageType,
    //   );
    // };

    provider.on('connection-close', (event) => {
      if (event) {
        if (event.wasClean) {
          // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
          void provider.connect();
        } else if (event.code === 1000) {
          /**
           * Handle the "Reset Connection" event from the server
           * This is triggered when the server wants to reset the connection
           * for clients in the room.
           * A disconnect is made automatically but it takes time to be triggered,
           * so we force the disconnection here.
           */
          provider.disconnect();
        }
      }
    });

    provider.on('status', (event) => {
      set((state) => {
        const nextConnected = event.status === 'connected';

        /**
         * status === 'connected' does not mean we are totally connected
         * because authentication can still be in progress and failed
         * So we only update isConnected when we loose the connection
         */
        const connected =
          event.status !== 'connected'
            ? {
                isConnected: false,
              }
            : undefined;

        return {
          ...connected,
          isReady: state.isReady || event.status === 'disconnected',
          hasLostConnection:
            state.isConnected && !nextConnected
              ? true
              : state.hasLostConnection,
        };
      });
    });

    provider.on('sync', (state) => {
      set({ isSynced: state, isReady: true });
    });

    // const provider = new CustomProvider({
    //   url: wsUrl,
    //   name: storeId,
    //   document: doc,
    //   onDisconnect(data) {
    //     // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
    //     if ((data.event as ExtendedCloseEvent).wasClean) {
    //       void provider.connect();
    //     }
    //   },
    //   onMessage(data) {
    //     console.log('-----');
    //     console.log(44444);
    //     console.log(data);
    //   },
    //   // onOutgoingMessage(data) {
    //   //   console.log('-----');
    //   //   console.log(555);
    //   //   console.log(data);
    //   // },
    //   onAuthenticationFailed() {
    //     set({ isReady: true, isConnected: false });
    //   },
    //   onAuthenticated() {
    //     set({ isReady: true, isConnected: true });
    //   },
    //   onStatus: ({ status }) => {
    //     set((state) => {
    //       const nextConnected = status === WebSocketStatus.Connected;

    //       /**
    //        * status === WebSocketStatus.Connected does not mean we are totally connected
    //        * because authentication can still be in progress and failed
    //        * So we only update isConnected when we loose the connection
    //        */
    //       const connected =
    //         status !== WebSocketStatus.Connected
    //           ? {
    //               isConnected: false,
    //             }
    //           : undefined;

    //       return {
    //         ...connected,
    //         isReady: state.isReady || status === WebSocketStatus.Disconnected,
    //         hasLostConnection:
    //           state.isConnected && !nextConnected
    //             ? true
    //             : state.hasLostConnection,
    //       };
    //     });
    //   },
    //   onSynced: ({ state }) => {
    //     set({ isSynced: state, isReady: true });
    //   },
    //   onClose(data) {
    //     /**
    //      * Handle the "Reset Connection" event from the server
    //      * This is triggered when the server wants to reset the connection
    //      * for clients in the room.
    //      * A disconnect is made automatically but it takes time to be triggered,
    //      * so we force the disconnection here.
    //      */
    //     if (data.event.code === 1000) {
    //       provider.disconnect();
    //     }
    //   },
    // });

    set({
      provider,
    });

    return provider;
  },
  destroyProvider: () => {
    const provider = get().provider;
    if (provider) {
      provider.destroy();
    }

    set(defaultValues);
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
}));
