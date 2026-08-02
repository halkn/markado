import { describe, expect, test } from "bun:test";
import { assertBindAllowed, isLoopbackAddress, serverUrl } from "../../src/server/bind.ts";

describe("bind addresses", () => {
  test("recognises every loopback spelling", () => {
    for (const address of ["localhost", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "LocalHost"]) {
      expect(isLoopbackAddress(address)).toBe(true);
    }
  });

  test("treats wildcards and routable addresses as remote", () => {
    for (const address of ["0.0.0.0", "::", "192.168.1.10", "example.local"]) {
      expect(isLoopbackAddress(address)).toBe(false);
    }
  });

  test("refuses a remote bind without the explicit flag", () => {
    expect(() => assertBindAllowed("0.0.0.0", false)).toThrow("--allow-remote-access");
    expect(() => assertBindAllowed("0.0.0.0", true)).not.toThrow();
    expect(() => assertBindAllowed("127.0.0.1", false)).not.toThrow();
  });

  test("builds a URL a browser can open", () => {
    expect(serverUrl("127.0.0.1", 6275)).toBe("http://127.0.0.1:6275/");
    expect(serverUrl("::1", 6275)).toBe("http://[::1]:6275/");
    expect(serverUrl("[::1]", 6275)).toBe("http://[::1]:6275/");
    // A wildcard is an interface, not somewhere to point a browser.
    expect(serverUrl("0.0.0.0", 6275)).toBe("http://localhost:6275/");
    expect(serverUrl("::", 6275)).toBe("http://localhost:6275/");
  });
});
