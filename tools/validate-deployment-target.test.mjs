import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const validator = join(here, 'validate-deployment-target.mjs');
const keys = [
  'ROADMAP2U_STAGE',
  'ROADMAP2U_AWS_ACCOUNT_ID',
  'ROADMAP2U_FRONTEND_BUCKET',
  'ROADMAP2U_DISTRIBUTION_ID',
  'ROADMAP2U_FRONTEND_URL',
  'ROADMAP2U_API_BASE_URL',
  'ROADMAP2U_RELEASE_SHA',
];

function cleanEnvironment() {
  const env = { ...process.env };
  for (const key of keys) delete env[key];
  return env;
}

function validEnvironment(stage = 'dev') {
  const frontendUrls = {
    dev: 'https://dev.roadmap2u.com',
    test: 'https://test.roadmap2u.com',
    prod: 'https://roadmap2u.com',
  };
  const apiUrls = {
    dev: 'https://api.dev.roadmap2u.com',
    test: 'https://api.test.roadmap2u.com',
    prod: 'https://api.roadmap2u.com',
  };
  return {
    ...cleanEnvironment(),
    ROADMAP2U_STAGE: stage,
    ROADMAP2U_AWS_ACCOUNT_ID: '123456789012',
    ROADMAP2U_FRONTEND_BUCKET: `roadmap2u-${stage}-123456789012`,
    ROADMAP2U_DISTRIBUTION_ID: 'E1234567890ABC',
    ROADMAP2U_FRONTEND_URL: frontendUrls[stage],
    ROADMAP2U_API_BASE_URL: apiUrls[stage],
    ROADMAP2U_RELEASE_SHA: 'a'.repeat(40),
  };
}

function run(env) {
  return spawnSync(process.execPath, [validator], { env, encoding: 'utf8' });
}

for (const stage of ['dev', 'test', 'prod']) {
  test(`accepts the exact ${stage} deployment target`, () => {
    const result = run(validEnvironment(stage));
    assert.equal(result.status, 0, result.stderr);
  });
}

test('rejects a bucket, frontend URL, and API URL from another stage', () => {
  const env = validEnvironment('test');
  env.ROADMAP2U_FRONTEND_BUCKET = 'roadmap2u-dev-123456789012';
  env.ROADMAP2U_FRONTEND_URL = 'https://dev.roadmap2u.com';
  env.ROADMAP2U_API_BASE_URL = 'https://api.dev.roadmap2u.com';
  const result = run(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected bucket roadmap2u-test-123456789012/i);
  assert.match(result.stderr, /expected frontend URL https:\/\/test\.roadmap2u\.com/i);
  assert.match(result.stderr, /expected API URL https:\/\/api\.test\.roadmap2u\.com/i);
});

test('rejects malformed account, distribution, and release identifiers', () => {
  const env = validEnvironment('prod');
  env.ROADMAP2U_AWS_ACCOUNT_ID = '123';
  env.ROADMAP2U_DISTRIBUTION_ID = 'not-a-distribution';
  env.ROADMAP2U_RELEASE_SHA = 'main';
  const result = run(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AWS account id/i);
  assert.match(result.stderr, /CloudFront distribution id/i);
  assert.match(result.stderr, /40-character commit SHA/i);
});
