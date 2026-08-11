import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateReleaseTag } from '../scripts/check-release-tag.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseTag = `v${packageJson.version}`;
const ciWorkflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');

test('release tag must exactly match the package version', () => {
  assert.equal(
    validateReleaseTag(releaseTag, packageJson.name, packageJson.version),
    `release tag ${releaseTag} matches ${packageJson.name}@${packageJson.version}`,
  );
  assert.throws(
    () => validateReleaseTag(`${releaseTag}-mismatch`, packageJson.name, packageJson.version),
    new RegExp(`does not match package version ${releaseTag}`),
  );
});

test('release tag is required', () => {
  assert.throws(
    () => validateReleaseTag(undefined, packageJson.name, packageJson.version),
    new RegExp(`release tag is required; expected ${releaseTag}`),
  );
});

test('pull request Storybook images load without unsupported attestations', () => {
  const storybookImageJob = ciWorkflow.slice(ciWorkflow.indexOf('  storybook-image:'));

  assert.match(storybookImageJob, /load: \$\{\{ github\.event_name != 'push' \}\}/);
  assert.match(
    storybookImageJob,
    /provenance: \$\{\{ github\.event_name == 'push' && 'mode=max' \|\| 'false' \}\}/,
  );
  assert.match(storybookImageJob, /sbom: \$\{\{ github\.event_name == 'push' \}\}/);
});
