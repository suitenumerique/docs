export declare interface AuthContext {
    /**
     * The identity provider's `sub` claim for the logged-in user. Products only
     * ever deal in subs — their own APIs know users by sub, and every SDK
     * operation (recipients, fingerprints, profiles) takes subs. The vault
     * resolves them to its internal, migration-stable user ids at its boundary
     * (local alias map, then public registry); that internal id never has to be
     * handled, stored, or even seen by a product.
     */
    suiteUserId: string;
}

export declare interface EncryptionClientEventMap {
    /** Fired when the hidden vault iframe is ready for encrypt/decrypt operations */
    [MSG_VAULT_READY]: void;
    /** Fired when the user completes onboarding (key generation + backup) */
    'onboarding:complete': {
        publicKey: string;
    };
    /** Fired when the user cancels or closes the interface */
    [MSG_INTERFACE_CLOSED]: void;
    /** Fired on errors from the vault or the interface */
    error: Error;
    /** Fired when keys changed from another tab/product (via BroadcastChannel) */
    'keys-changed': void;
    /** Fired when keys were destroyed from another tab/product (via BroadcastChannel) */
    'keys-destroyed': void;
    /** Fired when a fingerprint is accepted or refused in the local registry */
    'fingerprint-changed': void;
}

export declare interface EncryptionClientOptions {
    /** URL of the vault domain (data.encryption), e.g. "https://data.encryption.numerique.gouv.fr" */
    vaultUrl: string;
    /** URL of the interface domain (encryption), e.g. "https://encryption.numerique.gouv.fr" */
    interfaceUrl: string;
    /** Timeout in ms for vault operations (default: 30000) */
    timeout?: number;
    /**
     * Cunningham theme name for the interface iframe.
     * Standard names: "default", "dark", "dsfr", "dsfr-dark", "anct", "anct-dark".
     * Default: "default"
     */
    theme?: string;
    /** Language code for the interface iframe: "fr", "en", etc. (default: browser language) */
    lang?: string;
}

export declare const isVaultError: (err: unknown) => err is VaultError;

declare type Listener<K extends keyof EncryptionClientEventMap> = (data: EncryptionClientEventMap[K]) => void;

declare const MSG_INTERFACE_CLOSED = "interface:closed";

declare const MSG_VAULT_READY = "vault:ready";

export declare type RecipientLabel = {
    email: string;
    name?: string;
};

/**
 * Union on `verified` on purpose: `encryptionPublicKey` is a usable
 * `ArrayBuffer` only in the verified branch (`null` otherwise), so a caller
 * cannot wrap a key for a forged / incoherent directory entry without the
 * compiler stopping them. Identity and encryption key live in one per-user
 * entry so the two can never disagree for a user.
 */
export declare type RegisteredUser = {
    verified: true;
    signaturePublicKey: ArrayBuffer;
    identityFingerprint: string;
    version: number;
    createdAtMillis: number;
    encryptionPublicKey: ArrayBuffer;
} | {
    verified: false;
    signaturePublicKey: ArrayBuffer;
    identityFingerprint: string;
    version: number;
    createdAtMillis: number;
    encryptionPublicKey: null;
};

export declare class VaultClient {
    private vaultIframe;
    private interfaceIframe;
    private pending;
    private listeners;
    private vaultReadyResolve;
    private initTimeoutId;
    private messageHandler;
    private vaultUrl;
    private interfaceUrl;
    private vaultOrigin;
    private interfaceOrigin;
    private timeout;
    private theme;
    private lang;
    private authContext;
    private verifyOverlay;
    private verifyResolve;
    private emergencyOverlay;
    private emergencySurfaced;
    private emergencyWatchdog;
    private pendingContext;
    constructor(options: EncryptionClientOptions);
    /**
     * Update the Cunningham theme. If the interface iframe is open, sends it a
     * theme message so it re-themes in place.
     * @param theme - Cunningham theme name: "default", "dark", "dsfr", "dsfr-dark", "anct", "anct-dark", etc.
     */
    setTheme(theme: string): void;
    /**
     * Set the authentication context. Must be called before opening the interface.
     * The suiteUserId is passed to the interface iframe so it can register
     * public keys on the server and perform device transfers.
     */
    setAuthContext(context: AuthContext): void;
    /**
     * Read back the auth context that was set via {@link setAuthContext}.
     * Returns `null` until `setAuthContext` has been called. Useful when
     * the host app needs to identify the currently-bound suite user from
     * code that doesn't otherwise have access to the auth state — e.g.
     * the Drive driver's encryption-aware move handler, which has to
     * verify the operator (mover) keeps a per-user wrap during a
     * re-anchor and would otherwise need to thread the user identifier
     * through every call site.
     */
    getAuthContext(): AuthContext | null;
    /**
     * Initialize the encryption client.
     * Creates a hidden vault iframe (data.encryption) and waits for it to be ready.
     */
    init(): Promise<void>;
    /**
     * Clean up all iframes and event listeners.
     */
    destroy(): void;
    /** Check if the user has encryption keys on this device. */
    hasKeys(): Promise<{
        hasKeys: boolean;
    }>;
    /** Get the user's public key as ArrayBuffer. */
    getPublicKey(): Promise<{
        publicKey: ArrayBuffer;
    }>;
    /**
     * Create a new ROOT encrypted resource. Mints a fresh symmetric key,
     * encrypts `data` with it, and wraps the new key once per recipient.
     *
     * Pass recipients as a labeled map (OIDC sub → {email, name?}), not public
     * keys — the subs your product already holds for its users. The vault
     * resolves + trust-checks each recipient (binding + TOFU 'trusted' with
     * matching fingerprint, keyed internally so trust survives an OIDC provider
     * migration) before wrapping, and throws UNTRUSTED_RECIPIENT if any is
     * unverified or untrusted. Call checkFingerprints first to resolve any
     * 'unknown' contacts. The labels are display-only and used only if the trust
     * modal opens; the vault request itself sees just the subs.
     *
     * Use this for standalone encrypted files (no parent) and for the root
     * folder of an encrypted subtree.
     *
     * @returns encryptedContent and encryptedKeys (userId → wrappedKey)
     */
    encryptWithoutKey(data: ArrayBuffer, recipients: Record<string, RecipientLabel>, options?: {
        optimizeMemory?: boolean;
    }): Promise<{
        encryptedContent: ArrayBuffer;
        encryptedKeys: Record<string, ArrayBuffer>;
    }>;
    private encryptWithoutKeyRequest;
    /**
     * Create a new NESTED encrypted resource inside an existing encrypted
     * subtree. Resolves `entry + chain` to the parent folder's key, mints a
     * fresh symmetric key, encrypts `data` with it, and wraps the new key
     * under the parent's key.
     *
     * Use this for creating a file inside an already-encrypted folder.
     * Persist the returned `wrappedKey` on the new item's DB row.
     *
     * @param data - ArrayBuffer content to encrypt
     * @param encryptedSymmetricKey - caller's entry key (asymmetric bootstrap
     *   into the subtree, same value used for decryptWithKey)
     * @param encryptedKeyChain - optional symmetric wrappings from entry down
     *   to the parent folder (exclusive of the new resource, since it doesn't
     *   exist yet). Empty/omitted means the entry key IS the parent's key.
     */
    encryptNestedWithoutKey(data: ArrayBuffer, encryptedSymmetricKey: ArrayBuffer, encryptedKeyChain?: ArrayBuffer[], options?: {
        optimizeMemory?: boolean;
    }): Promise<{
        encryptedContent: ArrayBuffer;
        wrappedKey: ArrayBuffer;
    }>;
    /**
     * Encrypt content with an EXISTING symmetric key — pure symmetric mirror
     * of `decryptWithKey`. No new key is minted.
     *
     * Without `encryptedKeyChain`: resolves `encryptedSymmetricKey` (user's
     * entry key) and encrypts with it. Used by the flat model (Docs).
     *
     * With `encryptedKeyChain`: resolves entry + chain to the terminal
     * symmetric key and encrypts with it. Used by the collaborative relay
     * to encrypt messages tied to an existing file inside an encrypted
     * hierarchy, so that sender and receiver converge on the same K_file.
     */
    encryptWithKey(data: ArrayBuffer, encryptedSymmetricKey: ArrayBuffer, encryptedKeyChain?: ArrayBuffer[], options?: {
        optimizeMemory?: boolean;
    }): Promise<{
        encryptedData: ArrayBuffer;
    }>;
    /**
     * Decrypt content using a separately provided encrypted symmetric key.
     * The symmetric key decryption is cached per session for performance.
     *
     * @param encryptedData - ArrayBuffer ciphertext to decrypt
     * @param encryptedSymmetricKey - user's encrypted copy of the symmetric key
     * @param keyVersion - the recipient's encryption-key VERSION this wrap was
     *   produced against, as stored by the product on the access row. The vault
     *   unwraps with exactly that retained key (a version this device no longer
     *   holds throws WRONG_SECRET_KEY). For Drive chains it is the version of the
     *   ENTRY-point key; the chain links themselves are symmetric.
     * @param encryptedKeyChain - optional chain of wrapped keys for Drive's key hierarchy.
     *   When provided, resolves the chain from entry point to target before decrypting.
     */
    decryptWithKey(encryptedData: ArrayBuffer, encryptedSymmetricKey: ArrayBuffer, keyVersion: number, encryptedKeyChain?: ArrayBuffer[], options?: {
        optimizeMemory?: boolean;
    }): Promise<{
        data: ArrayBuffer;
    }>;
    /**
     * Re-wrap a nested resource's symmetric key from one parent chain onto
     * another. Used when MOVING an encrypted file/folder between positions
     * inside the same encrypted subtree: the file's content is left
     * untouched (still encrypted with K_file), but K_file's wrapping
     * follows its new parent.
     *
     * @param encryptedSymmetricKey - the user's entry-point key (root key
     *   wrapped under the user's pubkey). Same value for both old and new
     *   chains since this operation stays within a single encrypted root.
     * @param oldEncryptedKey - the resource's K_file as currently stored,
     *   wrapped under its OLD parent's key.
     * @param oldEncryptedKeyChain - chain of wrapped folder keys from the
     *   entry point down to (and including) the OLD parent's key. Omit /
     *   pass `undefined` when the OLD parent IS the encryption root.
     * @param newEncryptedKeyChain - chain entry → NEW parent. Omit when
     *   the NEW parent is the encryption root.
     * @returns the resource's K_file re-wrapped under the NEW parent's
     *   key — caller persists this on the resource's DB row, replacing
     *   the old wrapping.
     */
    rewrapNestedKey(encryptedSymmetricKey: ArrayBuffer, oldEncryptedKey: ArrayBuffer, oldEncryptedKeyChain?: ArrayBuffer[], newEncryptedKeyChain?: ArrayBuffer[]): Promise<{
        newEncryptedKey: ArrayBuffer;
    }>;
    /**
     * Wrap an existing per-user-anchored symmetric key under a parent
     * chain. Symmetric reverse of {@link shareKeys} (which goes 1→N
     * chain→per-user); this goes 1→1 per-user→chain.
     *
     * Used when MOVING a self-rooted encrypted resource (per-user
     * wraps on its access rows) INTO an encrypted subtree: K_item is
     * recovered from the user's per-user wrap, then wrapped under the
     * destination parent's chain so the resource stops being a root
     * and joins the destination tree.
     *
     * @param userEncryptedKey - the resource's per-user wrap from the
     *   caller's access row (`encrypted_item_symmetric_key_for_user`).
     * @param newEntryEncryptedSymmetricKey - user's entry-point key
     *   for the destination tree (the tree's root key wrapped under
     *   their pubkey — same value `getKeyChain` returns as
     *   `encrypted_key_for_user` for any item under that tree).
     * @param newEncryptedKeyChain - chain entry → NEW parent. Omit
     *   when the new parent IS the destination tree's root.
     * @returns the resource's K_item wrapped under the new parent's
     *   key — caller persists this on the resource's row.
     */
    wrapNestedKey(userEncryptedKey: ArrayBuffer, newEntryEncryptedSymmetricKey: ArrayBuffer, newEncryptedKeyChain?: ArrayBuffer[]): Promise<{
        newEncryptedKey: ArrayBuffer;
    }>;
    /**
     * Share an existing document's or item's symmetric key with additional users.
     *
     * Pass recipients as a labeled map (OIDC sub → {email, name?}), not public
     * keys: the vault resolves each recipient's encryption key from the directory
     * itself and wraps ONLY for identities whose binding verifies AND that you have marked
     * 'trusted' (TOFU) with a matching fingerprint. If any recipient is unverified
     * or untrusted it throws UNTRUSTED_RECIPIENT and wraps for none — call
     * checkFingerprints (and resolve any 'unknown') first. Recipients are resolved
     * in one batched request. The labels are display-only and used only if the
     * trust modal opens; the vault request itself sees just the userIds.
     *
     * @param encryptedSymmetricKey - current user's encrypted copy of the key
     * @param recipients - map of userId → display label to share with
     * @param encryptedKeyChain - optional chain of wrapped keys for Drive's key hierarchy.
     *   When provided, resolves the chain from entry point to the target item's key
     *   before re-encrypting for the target users.
     * @returns encryptedKeys - Record of userId → ArrayBuffer encrypted symmetric key for each user
     */
    shareKeys(encryptedSymmetricKey: ArrayBuffer, recipients: Record<string, RecipientLabel>, encryptedKeyChain?: ArrayBuffer[]): Promise<{
        encryptedKeys: Record<string, ArrayBuffer>;
    }>;
    private shareKeysRequest;
    /**
     * Fetch registered users for a list of OIDC subs (the ids your product
     * already holds). The vault calls the encryption server itself (products
     * never touch it) and verifies each record's binding signature before
     * returning. The map is keyed by the subs you queried; subs with no active
     * registration are absent (that person never onboarded encryption). Use it
     * when building a sharing UI: it tells you who has keys, their fingerprint,
     * and whether the directory record is coherent (`verified`).
     */
    fetchPublicKeys(subs: string[]): Promise<Record<string, RegisteredUser>>;
    /**
     * Check fingerprints provided by the product against the vault's local registry.
     * The product sends the fingerprints it stored at share time, keyed by OIDC
     * sub; results echo the same subs back (the vault translates to its internal
     * trust keys on its side).
     *
     * Returns results with status: "trusted", "refused", or "unknown" (needs user decision).
     */
    checkFingerprints(userFingerprints: Record<string, string>): Promise<{
        results: Array<{
            userId: string;
            knownFingerprint: string | null;
            providedFingerprint: string;
            status: 'trusted' | 'refused' | 'unknown' | 'mismatch';
        }>;
    }>;
    /**
     * Get all known fingerprints with their status from the local registry.
     */
    getKnownFingerprints(): Promise<{
        fingerprints: Record<string, {
            fingerprint: string;
            status: 'trusted' | 'refused' | 'unknown';
        }>;
    }>;
    /**
     * Compute a 128-bit DECIMAL fingerprint of a public key: the first 16 bytes of
     * its SHA-256, read big-endian as a fixed-width 40-digit decimal. Matches the
     * device-pairing fingerprint so every surface shows the same value.
     * This is a pure client-side operation — no vault iframe needed.
     *
     * @param publicKey - The public key as ArrayBuffer (from fetchPublicKeys or getPublicKey)
     */
    computeKeyFingerprint(publicKey: ArrayBuffer): Promise<string>;
    /**
     * Format a raw decimal fingerprint for display, grouped in blocks of five.
     */
    formatFingerprint(fingerprint: string): string;
    /**
     * Open the encryption interface for onboarding (key generation + backup).
     * The product provides a container element where the interface iframe will be mounted.
     * The product is responsible for showing/hiding this container (e.g. in a modal).
     *
     * Listen to 'onboarding:complete' and 'interface:closed' events for results.
     */
    openOnboarding(container: HTMLElement): void;
    /**
     * Open the encryption interface for key backup/export.
     */
    openBackup(container: HTMLElement): void;
    /**
     * Open the encryption interface for key restoration from backup.
     */
    openRestore(container: HTMLElement): void;
    /**
     * Open the encryption settings (view fingerprint, delete keys).
     */
    openSettings(container: HTMLElement): void;
    /**
     * Open device approval: enroll this device from another, or approve a new one.
     */
    openDeviceApproval(container: HTMLElement): void;
    /**
     * Open the emergency-access (trusted contacts) management screen: designate
     * contacts, accept a designation, follow or refuse a running recovery.
     */
    openEmergencyAccess(container: HTMLElement): void;
    /**
     * Open the per-recipient profile: the recipient's current trust decision, their
     * identity fingerprint (for out-of-band comparison), and Trust / Refuse actions.
     * Opened explicitly by the product (e.g. clicking a person in its share UI), so
     * it mounts in a product-provided container like the other open* methods.
     * `userId` is the recipient's OIDC sub, like every id a product passes.
     */
    openRecipientProfile(container: HTMLElement, userId: string, label: RecipientLabel): void;
    /**
     * Close the interface iframe if it is open.
     */
    closeInterface(): void;
    on<K extends keyof EncryptionClientEventMap>(event: K, listener: Listener<K>): void;
    off<K extends keyof EncryptionClientEventMap>(event: K, listener: Listener<K>): void;
    private openInterface;
    /**
     * Construct and configure an interface iframe for `path` (sandbox, allow,
     * theme/lang hash, context handshake). Mounting is left to the caller so the
     * same setup serves both the product-provided container (openInterface) and
     * the SDK-created full-screen overlay (openVerifyRecipients).
     *
     * `overlay` travels in the HASH, not in the postMessage context, precisely
     * because the context arrives asynchronously: a screen that renders as a page
     * when embedded and as a modal when overlaid would otherwise paint the page
     * variant first (full-width and opaque, over the product) and swap to the modal
     * only once the handshake lands, which reads as a flash.
     */
    private buildInterfaceIframe;
    /** The context message currently owed to the interface, or null before auth. */
    private sendContext;
    /**
     * Open the SDK-owned "verify recipients" overlay on top of the product's own
     * share dialog, and resolve with the user's outcome. The SDK deliberately does
     * NOT draw any chrome here: the container is a minimal, transparent, full-
     * viewport layer, and the interface (a Cunningham Modal) draws the whole modal
     * (its own backdrop + card) inside the transparent iframe, so it matches the
     * rest of the interface UI. Tears the overlay down once the outcome is in.
     */
    private openVerifyRecipients;
    /**
     * Auto-open the interface over the product when the vault reports actionable
     * emergency-access state: a running recovery request against the user's vault
     * (which they must be able to refuse without hunting for a menu) or a pending
     * trusted-contact designation to accept. Same transparent-overlay technique
     * as the verify-recipients flow; at most once per page load, and never while
     * another interface flow is already open (the settings screen shows the same
     * state anyway).
     *
     * This one is the ONLY flow the SDK opens on its own initiative, so it is held
     * to a stricter rule than the flows a product asked for: it stays invisible
     * until the interface says it is up, and if it never says so it is removed
     * rather than left covering the page. Both halves hang off the same signal:
     *
     *  - the interface asks for its context (MSG_INTERFACE_REQUEST_CONTEXT) as soon
     *    as its React app mounts, so that is "the remote page is ready";
     *  - until then `visibility: hidden` keeps the blank document, then the app's
     *    first frames, off the screen;
     *  - if it never arrives (bundle blocked, offline, a redirect leaving an empty
     *    document, a crash before mount) the watchdog removes the whole overlay, so
     *    a broken interface never sits on top of the product swallowing clicks. The
     *    user loses nothing: the same state is in the settings screen, and the
     *    load-bearing channel for all of this is email.
     */
    private surfaceEmergencyPending;
    /**
     * The interface app mounted. Reveal the overlay we kept hidden and stand the
     * watchdog down. No-op for every other flow (the product owns their container).
     */
    private revealEmergencyOverlay;
    private teardownEmergencyOverlay;
    private completeVerify;
    private teardownVerifyOverlay;
    /**
     * Run a recipient-bearing operation, and on UNTRUSTED_RECIPIENT open the shared
     * verify modal for the ORIGINAL recipients (full labeled map; the interface
     * surfaces only the blocked ones). If the user trusts them all, retry the
     * operation exactly once; otherwise rethrow the original error so the product
     * sees the share failed (all-or-nothing). Any other error rethrows unchanged.
     * This is always on: whether to prompt for trust is not a product choice, so
     * there is no opt-out.
     */
    private withRecipientVerification;
    private vaultRequest;
    private handleMessage;
    private handleVaultMessage;
    private handleInterfaceMessage;
    private removeIframe;
    private emit;
}

/**
 * Error subclass tagged with a stable {@link VaultErrorCode}. Throw this
 * (instead of `new Error(...)`) anywhere inside the SDK so the boundary
 * marshaller can pass the code along to consumers.
 *
 * Note: `VaultError` instances DO NOT survive `structuredClone` — the
 * postMessage layer marshals `{ message, code }` explicitly and
 * reconstructs the class on the receiving side.
 */
export declare class VaultError extends Error {
    readonly code: VaultErrorCode;
    constructor(code: VaultErrorCode, message: string);
}

/**
 * Stable error codes that travel across the vault iframe ↔ client
 * postMessage boundary. Consumers (drive / docs / meet) match on these
 * instead of regexing error messages — message text is for logs / humans
 * and may change, the codes are part of the SDK contract.
 *
 * Why a string-keyed const (not a TS enum): keeps the runtime values
 * tree-shakeable, and the strings double as wire identifiers when
 * marshalled over postMessage.
 */
export declare const VaultErrorCode: {
    /** No key pair stored locally on this device — user must onboard. */
    readonly MISSING_KEYS: "MISSING_KEYS";
    /**
     * AEAD verification failed. Either the ciphertext is for a different
     * recipient (their wrapped symmetric key was encrypted against another
     * pubkey) or the underlying KEM secret didn't match. Bubbles up from
     * libsodium's "wrong secret key for the given ciphertext".
     */
    readonly WRONG_SECRET_KEY: "WRONG_SECRET_KEY";
    /** Backup payload is corrupted, truncated, or from an unsupported version. */
    readonly INVALID_BACKUP: "INVALID_BACKUP";
    /** BIP-39-style mnemonic input that doesn't checksum. */
    readonly INVALID_MNEMONIC: "INVALID_MNEMONIC";
    /** Caller hit a vault method without first calling `init()`. */
    readonly NOT_INITIALIZED: "NOT_INITIALIZED";
    /** `setAuthContext({ suiteUserId })` was never called. */
    readonly AUTH_REQUIRED: "AUTH_REQUIRED";
    /**
     * The declared sub could not be resolved to an internal encryption user id:
     * no local alias, and no directory row (either the user never onboarded, or
     * the registry was unreachable with nothing cached). Thrown by every vault
     * operation EXCEPT `has-keys`, which responds `{ hasKeys: false }` instead
     * of throwing: for that probe, "unresolvable" and "never onboarded" are the
     * same answer, and products use it to decide whether to offer onboarding.
     */
    readonly UNRESOLVED_USER: "UNRESOLVED_USER";
    /** Privileged operation attempted from a non-encryption-origin caller. */
    readonly PRIVILEGED_ORIGIN_REQUIRED: "PRIVILEGED_ORIGIN_REQUIRED";
    /** A vault request didn't get an answer within the configured timeout. */
    readonly TIMEOUT: "TIMEOUT";
    /** Vault module loaded outside an iframe (origin-isolation invariant). */
    readonly IFRAME_REQUIRED: "IFRAME_REQUIRED";
    /** Ciphertext / encrypted-key payload too short to be valid (truncated). */
    readonly CIPHERTEXT_TOO_SHORT: "CIPHERTEXT_TOO_SHORT";
    /** Blob's leading version byte doesn't match a format this build can decode. */
    readonly UNSUPPORTED_CRYPTO_VERSION: "UNSUPPORTED_CRYPTO_VERSION";
    /** A signature public key didn't have the expected Ed25519 length. */
    readonly INVALID_SIGNATURE_KEY: "INVALID_SIGNATURE_KEY";
    /**
     * A registry entry's binding signature did not verify against its claimed
     * identity (signature) key — the directory record is forged, tampered, or
     * incoherent. Consumers MUST refuse to trust / share with such an entry.
     */
    readonly INVALID_KEY_BINDING: "INVALID_KEY_BINDING";
    /**
     * A pulled vault failed its integrity check: the identity-signed manifest did
     * not verify, an item's ciphertext hash or coverage did not match, or the
     * revision rolled back. Distinct from a wrong recovery phrase (which fails the
     * unlock, not the integrity check) — it means the SERVER served tampered or
     * incoherent vault data, so the user must be warned, not told to re-type.
     */
    readonly VAULT_INTEGRITY_FAILED: "VAULT_INTEGRITY_FAILED";
    /**
     * A wrap was attempted for a recipient whose identity is not TOFU-'trusted'
     * with a matching fingerprint (refused, never verified, or a fingerprint
     * mismatch that may be a MITM-substituted key). The vault refuses to wrap the
     * symmetric key until the recipient's identity is verified. The offending
     * userIds are in the error message.
     */
    readonly UNTRUSTED_RECIPIENT: "UNTRUSTED_RECIPIENT";
    /**
     * A write-through change (e.g. a TOFU decision) could not be pushed to the
     * server, so it was NOT kept locally either — the caller should surface a
     * "couldn't save, retry" and the local state is unchanged. Distinct from a
     * network throw (which also aborts before persisting).
     */
    readonly SYNC_FAILED: "SYNC_FAILED";
    /**
     * The request reached a handler but its payload does not satisfy that
     * operation's contract (a missing required field, or none of a set of mutually
     * exclusive ones). A CALLER bug, not a user condition: it is surfaced rather
     * than defaulted so a malformed call fails loud instead of acting on a
     * half-specified target.
     */
    readonly INVALID_REQUEST: "INVALID_REQUEST";
    /**
     * Catch-all for situations the SDK couldn't classify into a more
     * specific code — present so consumers always have something to switch
     * on rather than falling back to message regex.
     */
    readonly UNKNOWN: "UNKNOWN";
};

export declare type VaultErrorCode = (typeof VaultErrorCode)[keyof typeof VaultErrorCode];

export { }

export as namespace EncryptionClient;
