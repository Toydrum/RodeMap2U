#!/usr/bin/env node

const requiredInputs = [
  'ROADMAP2U_STAGE',
  'ROADMAP2U_AWS_ACCOUNT_ID',
  'ROADMAP2U_FRONTEND_BUCKET',
  'ROADMAP2U_DISTRIBUTION_ID',
  'ROADMAP2U_FRONTEND_URL',
  'ROADMAP2U_API_BASE_URL',
  'ROADMAP2U_RELEASE_SHA',
];
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

const values = Object.fromEntries(
  requiredInputs.map((key) => [key, process.env[key]?.trim() ?? '']),
);
const errors = requiredInputs.filter((key) => !values[key]).map((key) => `${key} is required`);

const stage = values.ROADMAP2U_STAGE;
const accountId = values.ROADMAP2U_AWS_ACCOUNT_ID;
if (stage && !(stage in frontendUrls)) errors.push('ROADMAP2U_STAGE must be dev, test, or prod');
if (accountId && !/^\d{12}$/.test(accountId)) {
  errors.push('ROADMAP2U_AWS_ACCOUNT_ID must be a 12-digit AWS account id');
}

if (stage in frontendUrls && /^\d{12}$/.test(accountId)) {
  const expectedBucket = `roadmap2u-${stage}-${accountId}`;
  if (values.ROADMAP2U_FRONTEND_BUCKET !== expectedBucket) {
    errors.push(`expected bucket ${expectedBucket}`);
  }
  if (values.ROADMAP2U_FRONTEND_URL !== frontendUrls[stage]) {
    errors.push(`expected frontend URL ${frontendUrls[stage]}`);
  }
  if (values.ROADMAP2U_API_BASE_URL !== apiUrls[stage]) {
    errors.push(`expected API URL ${apiUrls[stage]}`);
  }
}

if (
  values.ROADMAP2U_DISTRIBUTION_ID &&
  !/^E[A-Z0-9]{8,20}$/.test(values.ROADMAP2U_DISTRIBUTION_ID)
) {
  errors.push('ROADMAP2U_DISTRIBUTION_ID must be a CloudFront distribution id');
}
if (values.ROADMAP2U_RELEASE_SHA && !/^[a-f0-9]{40}$/.test(values.ROADMAP2U_RELEASE_SHA)) {
  errors.push('ROADMAP2U_RELEASE_SHA must be an exact 40-character commit SHA');
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`target: ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`validated ${stage} target for ${values.ROADMAP2U_RELEASE_SHA}\n`);
}
