const LOOPBACK_HOSTNAMES = new Set(["localhost", "::1", "0:0:0:0:0:0:0:1"]);

const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

const WILDCARD_ADDRESSES = new Set(["", "0.0.0.0", "::"]);

export function isLoopbackAddress(address: string): boolean {
  const host = stripBrackets(address).toLowerCase();
  return LOOPBACK_HOSTNAMES.has(host) || IPV4_LOOPBACK.test(host);
}

/**
 * mdiv serves every file under the wiki root to whoever can reach the port, so
 * leaving the loopback interface is a decision the reader has to make on
 * purpose rather than a typo in `--bind`.
 */
export function assertBindAllowed(bind: string, allowRemoteAccess: boolean): void {
  if (allowRemoteAccess || isLoopbackAddress(bind)) {
    return;
  }

  throw new Error(
    `--bind ${bind} would serve the wiki to other machines on the network. ` +
      "Add --allow-remote-access to confirm, or bind to 127.0.0.1.",
  );
}

/** A URL a browser can actually open: wildcards are not addresses, and IPv6 needs brackets. */
export function serverUrl(bind: string, port: number): string {
  const host = stripBrackets(bind);
  if (WILDCARD_ADDRESSES.has(host)) {
    return `http://localhost:${port}/`;
  }
  return host.includes(":") ? `http://[${host}]:${port}/` : `http://${host}:${port}/`;
}

function stripBrackets(address: string): string {
  return address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
}
