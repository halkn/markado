/**
 * What the server has been told about its own exposure. Everything that reacts
 * to it — the accepted `Host` values, the shell's `img-src` — reads it from
 * here rather than re-deriving it from the CLI flags.
 */
export type SecurityOptions = {
  /** The address passed to `Bun.serve`, not the address a request arrived on. */
  bind: string;
  allowRemoteImages: boolean;
};

export const DEFAULT_SECURITY: SecurityOptions = {
  bind: "127.0.0.1",
  allowRemoteImages: false,
};
