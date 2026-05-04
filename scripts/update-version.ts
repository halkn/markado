const nextVersion = Bun.argv[2];

if (!nextVersion || !isValidVersion(nextVersion)) {
  console.error("Usage: bun run version <x.y.z[-prerelease][+build]>");
  process.exit(1);
}

const packageJsonFile = Bun.file("package.json");
const packageJson = (await packageJsonFile.json()) as {
  version?: string;
  [key: string]: unknown;
};
packageJson.version = nextVersion;

await Bun.write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
await Bun.write("src/version.ts", `export const VERSION = ${JSON.stringify(nextVersion)};\n`);

console.log(`Updated version to ${nextVersion}`);

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}
