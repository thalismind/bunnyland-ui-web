import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateReleaseTag } from '../scripts/check-release-tag.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseTag = `v${packageJson.version}`;

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
