# Backend repository separation

The AWS extraction is complete. Infrastructure and Lambda code live in
[`Toydrum/roadmap2u-backend`](https://github.com/Toydrum/roadmap2u-backend);
this repository contains the Angular PWA, the executable mock, and the
normative client-side contract. New infrastructure work belongs in the backend
repository.

## Shared contract

The frontend owns these Angular-free source files:

| Frontend source | Backend vendored copy |
|---|---|
| `src/app/core/api/contracts.ts` | `shared/api/contracts.ts` |
| `src/app/core/db/schema.ts` | `shared/db/schema.ts` |
| `src/app/core/auth/auth-types.ts` | `shared/auth/auth-types.ts` |

The backend's sync command is the only supported way to refresh `shared/`.
Its parity test compares the vendored files byte-for-byte with a neighboring
frontend checkout when one is available. This byte-parity test is intentionally
separate from the deployment digest.

The deployment digest is EOL-stable. It hashes, in this exact order, each
relative backend path encoded as UTF-8, NUL, the file text after CRLF-to-LF
normalization, then NUL:

1. `api/contracts.ts`
2. `db/schema.ts`
3. `auth/auth-types.ts`

Both repositories must compute the same lowercase SHA-256. The backend writes
it to `/roadmap2u/<stage>/contract-hash`; the frontend generator rejects a
deployment when it differs from the checkout being built.

## Change protocol

1. Change the normative frontend file and the on-device mock in the same
   frontend change.
2. In the backend repository, run its contract sync command and review the
   byte-level diff.
3. Adapt Lambda handlers and tests, then run backend tests and CDK synthesis.
4. Deploy the backend stage so its SSM contract hash and other handoff values
   are current.
5. Deploy the exact frontend SHA to `dev`; promote the same successful SHA to
   `test` and then `prod`.

Never edit a backend `shared/` file by hand and never weaken either parity
check to make drift pass.

## Repository responsibilities

The frontend retains:

- `docs/backend-contract.md` and `docs/aws-connect.md`;
- `mock-api.ts` and `mock-auth.provider.ts` as the executable behavioral spec;
- the generated-config, deployment-target, built-PWA, smoke, and bundle gates;
- GitHub Actions for frontend CI, stage delivery, promotion, and rollback.

The backend repository owns:

- CDK stacks and all AWS resources;
- Cognito, Lambda, API Gateway, DynamoDB, S3, CloudFront, Route 53, ACM, and
  stage-selected OIDC roles;
- stage-aware CORS and production DNS cutover;
- SSM handoff parameters and contract-hash publication;
- backend tests, synthesis, deployment, and infrastructure rollback.

Before AWS deploy is enabled, an operator must create and review a
minimum-privilege CloudFormation execution managed policy for each stage. The
backend documents this activation gate; it deliberately does not claim that a
generic same-account policy is a safe stage boundary.

The frontend does not consume copied stack outputs. Its workflows read SSM
after assuming the stage role through OIDC, generate the build-time config,
and validate account, region, hostnames, bucket, CloudFront alias/origin/OAC,
and contract hash before publication.

## Completion record

- [x] Backend code moved to its own repository.
- [x] Three shared files vendored with parity coverage.
- [x] Cross-platform normalized contract digest defined.
- [x] Stage handoff published through SSM.
- [x] Frontend AWS workflows prepared behind `AWS_DEPLOY_ENABLED`.
- [x] Legacy GitHub Pages workflow made manual-only for the data-migration
  window.
- [ ] Deploy AWS stages and enable the frontend gate after operator approval.
- [ ] Cut production DNS over after the CloudFront-host smoke is green.

The operational sequence, GitHub variables, exact stage URLs, release markers,
and rollback procedure are documented in
[`aws-connect.md`](./aws-connect.md).
