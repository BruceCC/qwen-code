/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getPackageVersion() {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function incrementPatchVersion(version) {
  const parts = version.split('.');
  const major = parseInt(parts[0]);
  const minor = parseInt(parts[1]);
  const patch = parseInt(parts[2].split('-')[0]); // Handle pre-release versions
  return `${major}.${minor}.${patch + 1}`;
}

function getLatestNightlyCount() {
  try {
    // Try to get the latest nightly tag from git to determine the counter
    const currentVersion = getPackageVersion();
    const nextVersion = incrementPatchVersion(currentVersion);
    const tags = execSync(`git tag -l "v${nextVersion}-nightly.*"`)
      .toString()
      .trim();

    if (!tags) return 0;

    const nightlyTags = tags.split('\n').filter(Boolean);
    const counts = nightlyTags.map((tag) => {
      const match = tag.match(/nightly\.(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

    return Math.max(...counts, -1) + 1;
  } catch (_error) {
    // If we can't get tags, start from 0
    return 0;
  }
}

export function getNightlyTagName() {
  const version = getPackageVersion();
  const nextVersion = incrementPatchVersion(version);
  const nightlyCount = getLatestNightlyCount();

  return `v${nextVersion}-nightly.${nightlyCount}`;
}

export function getReleaseVersion() {
  const isNightly = process.env.IS_NIGHTLY === 'true';
  const manualVersion = process.env.MANUAL_VERSION;

  let releaseTag;

  if (isNightly) {
    console.error('Calculating next nightly version...');
    releaseTag = getNightlyTagName();
  } else if (manualVersion) {
    console.error(`Using manual version: ${manualVersion}`);
    releaseTag = manualVersion;
  } else {
    throw new Error(
      'Error: No version specified and this is not a nightly release.',
    );
  }

  if (!releaseTag) {
    throw new Error('Error: Version could not be determined.');
  }

  if (!releaseTag.startsWith('v')) {
    console.error("Version is missing 'v' prefix. Prepending it.");
    releaseTag = `v${releaseTag}`;
  }

  if (releaseTag.includes('+')) {
    throw new Error(
      'Error: Versions with build metadata (+) are not supported for releases. Please use a pre-release version (e.g., v1.2.3-alpha.4) instead.',
    );
  }

  if (!releaseTag.match(/^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$/)) {
    throw new Error(
      'Error: Version must be in the format vX.Y.Z or vX.Y.Z-prerelease',
    );
  }

  const releaseVersion = releaseTag.substring(1);
  let npmTag = 'latest';
  if (releaseVersion.includes('-')) {
    const prereleasePart = releaseVersion.split('-')[1];
    npmTag = prereleasePart.split('.')[0];

    // Ensure nightly releases use 'nightly' tag, not 'latest'
    if (npmTag === 'nightly') {
      npmTag = 'nightly';
    }
  }

  return { releaseTag, releaseVersion, npmTag };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const versions = getReleaseVersion();
    console.log(JSON.stringify(versions));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
