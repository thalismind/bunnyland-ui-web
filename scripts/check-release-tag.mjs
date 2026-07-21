import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
export function validateReleaseTag(actualTag, name, version) {
  const expectedTag = `v${version}`;

  if (!actualTag) {
    throw new Error(`release tag is required; expected ${expectedTag}`);
  }
  if (actualTag !== expectedTag) {
    throw new Error(`release tag ${actualTag} does not match package version ${expectedTag}`);
  }

  return `release tag ${actualTag} matches ${name}@${version}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(validateReleaseTag(process.argv[2], packageJson.name, packageJson.version));
}
