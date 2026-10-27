/**
 * Encrypted WebSocket wrapper for real-time Yjs collaboration.
 *
 * Uses the VaultClient SDK for all encrypt/decrypt operations via postMessage
 * to the vault iframe. All data transfers use ArrayBuffer for zero-copy
 * performance. The vault caches the decrypted symmetric key per session
 * so only the first message incurs the hybrid decapsulation cost.
 */

export class EncryptedWebSocket extends WebSocket {
  protected readonly vaultClient!: VaultClient;
  protected readonly encryptedSymmetricKey!: ArrayBuffer;
  protected readonly keyVersion!: number;
  protected readonly onSystemMessage?: (message: string) => void;
  protected readonly onDecryptError?: (err: unknown) => void;

  constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols);

    const originalAddEventListener = this.addEventListener.bind(this);
    const originalRemoveEventListener = this.removeEventListener.bind(this);
    // The decrypting wrappers of the message listeners, so that detaching the
    // socket (see the `onmessage` setter) can remove them.
    const messageListeners: EventListener[] = [];
    let detached = false;

    this.addEventListener = function <K extends keyof WebSocketEventMap>(
      type: K,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'message') {
        const wrappedListener: typeof listener = async (event) => {
          const messageEvent = event as MessageEvent;

          // System messages (strings) bypass encryption
          if (typeof messageEvent.data === 'string') {
            this.onSystemMessage?.(messageEvent.data);

            return;
          }

          if (!(messageEvent.data instanceof ArrayBuffer)) {
            throw new Error(
              'WebSocket data should always be ArrayBuffer (binaryType)',
            );
          }

          try {
            // Decrypt directly with ArrayBuffer — no base64 conversion
            const { data: decryptedBuffer } =
              await this.vaultClient.decryptWithKey(
                messageEvent.data,
                this.encryptedSymmetricKey,
                this.keyVersion,
              );

            // Detached while this frame was being decrypted: drop it, as the
            // provider no longer listens to this socket.
            if (detached) {
              return;
            }

            const decryptedData = new Uint8Array(decryptedBuffer);

            if (typeof listener === 'function') {
              listener.call(this, { ...event, data: decryptedData });
            } else {
              listener.handleEvent.call(this, {
                ...event,
                data: decryptedData,
              });
            }
          } catch (err) {
            console.error('WebSocket decrypt error:', err);
            this.onDecryptError?.(err);
          }
        };

        messageListeners.push(wrappedListener);
        originalAddEventListener('message', wrappedListener, options);
      } else {
        originalAddEventListener(type, listener, options);
      }
    };

    // Block direct onmessage assignment: a handler set that way would receive
    // the ciphertext, bypassing the decrypting listeners above.
    let explicitlySetListener:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((this: WebSocket, handlerEvent: MessageEvent) => any) | null = null;

    Object.defineProperty(this, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        return explicitlySetListener;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors lib.dom WebSocket.onmessage signature (=> any)
      set(handler: ((handlerEvent: MessageEvent) => any) | null) {
        explicitlySetListener = null;

        // y-websocket detaches a socket it drops with `onmessage = null`, so that
        // frames still buffered while it closes cannot touch the provider. The
        // provider listens through addEventListener here (see the y-websocket
        // patch), so detaching means removing those listeners.
        if (handler === null) {
          detached = true;
          messageListeners
            .splice(0)
            .forEach((listener) =>
              originalRemoveEventListener('message', listener),
            );

          return;
        }

        throw new Error(
          '"onmessage" should not be set directly. Use addEventListener instead. Run "yarn run patch-package"!',
        );
      },
    });
  }

  sendSystemMessage(message: string) {
    super.send(message);
  }

  send(message: Uint8Array<ArrayBuffer>) {
    if (this.readyState !== WebSocket.OPEN) {
      return;
    }

    // Encrypt directly with ArrayBuffer, no base64 conversion
    this.vaultClient
      .encryptWithKey(message.buffer, this.encryptedSymmetricKey)
      .then(({ encryptedData }) => {
        // Encryption is asynchronous: the socket may have closed meanwhile (the
        // editor publishes its presence removal while it unmounts). Nobody is
        // left to receive it on this socket, so it is dropped.
        if (this.readyState !== WebSocket.OPEN) {
          return;
        }

        super.send(new Uint8Array(encryptedData));
      })
      .catch((error) => {
        console.error('WebSocket encrypt error:', error);
      });
  }
}

export function createAdaptedEncryptedWebsocketClass(options: {
  vaultClient: VaultClient;
  encryptedSymmetricKey: ArrayBuffer;
  keyVersion: number;
  onSystemMessage?: (message: string) => void;
  onDecryptError?: (err: unknown) => void;
}) {
  return class extends EncryptedWebSocket {
    protected readonly vaultClient = options.vaultClient;
    protected readonly encryptedSymmetricKey = options.encryptedSymmetricKey;
    protected readonly keyVersion = options.keyVersion;
    protected readonly onSystemMessage = options.onSystemMessage;
    protected readonly onDecryptError = options.onDecryptError;
  };
}
