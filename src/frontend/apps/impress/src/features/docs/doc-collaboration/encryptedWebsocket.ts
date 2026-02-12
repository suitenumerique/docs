import type { MessageEvent } from 'ws';

import { decrypt, encrypt } from '@/docs/doc-collaboration/encryption';

export class EncryptedWebSocket extends WebSocket {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const messageEvent = event as any;

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (!(messageEvent.data instanceof ArrayBuffer)) {
            throw new Error(
              `the data over the wire should always be ArrayBuffer since defined on the websocket property "binaryType"`,
            );
          }

          const manageableData = new Uint8Array<ArrayBufferLike>(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            messageEvent.data as ArrayBufferLike,
          );
          const decryptedData = decrypt(manageableData);

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

    let explicitlySetListener: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((this: WebSocket, handlerEvent: MessageEvent) => any) | null;
    null;

    Object.defineProperty(this, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        console.log('GETTING ONMESSAGE');

        return explicitlySetListener;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
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
    return super.send(encrypt(message));
  }
}
