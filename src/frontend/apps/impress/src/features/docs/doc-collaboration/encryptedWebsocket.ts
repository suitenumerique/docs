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
  protected readonly onSystemMessage?: (message: string) => void;
  protected readonly onDecryptError?: (err: unknown) => void;

  constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols);

    const originalAddEventListener = this.addEventListener.bind(this);

    this.addEventListener = function <K extends keyof WebSocketEventMap>(
      type: K,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'message') {
        const wrappedListener: typeof listener = async (event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const messageEvent = event as any;

          // System messages (strings) bypass encryption
          if (typeof messageEvent.data === 'string') {
            this.onSystemMessage?.(messageEvent.data as string);

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
                messageEvent.data as ArrayBuffer,
                this.encryptedSymmetricKey,
              );

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

        originalAddEventListener('message', wrappedListener, options);
      } else {
        originalAddEventListener(type, listener, options);
      }
    };

    // Block direct onmessage assignment
    let explicitlySetListener: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((this: WebSocket, handlerEvent: MessageEvent) => any) | null;
    null;

    Object.defineProperty(this, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        return explicitlySetListener;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      set(handler: ((handlerEvent: MessageEvent) => any) | null) {
        explicitlySetListener = null;

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
    // Encrypt directly with ArrayBuffer — no base64 conversion
    this.vaultClient
      .encryptWithKey(
        message.buffer as ArrayBuffer,
        this.encryptedSymmetricKey,
      )
      .then(({ encryptedData }) => {
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
  onSystemMessage?: (message: string) => void;
  onDecryptError?: (err: unknown) => void;
}) {
  return class extends EncryptedWebSocket {
    protected readonly vaultClient = options.vaultClient;
    protected readonly encryptedSymmetricKey = options.encryptedSymmetricKey;
    protected readonly onSystemMessage = options.onSystemMessage;
    protected readonly onDecryptError = options.onDecryptError;
  };
}
