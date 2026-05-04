import { VERSION } from "../src/version.ts";

const packageJson = (await Bun.file("package.json").json()) as { version?: string };

if (packageJson.version !== VERSION) {
  console.error(`Version mismatch: package.json=${packageJson.version}, src/version.ts=${VERSION}`);
  process.exit(1);
}
