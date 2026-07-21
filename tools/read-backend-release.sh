#!/usr/bin/env bash
set -euo pipefail

: "${STAGE:?STAGE is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

get_parameter() {
  aws ssm get-parameter --name "$1" --query 'Parameter.Value' --output text
}

BACKEND_RELEASE_SHA="$(get_parameter "/roadmap2u/${STAGE}/backend-release-sha")"
[[ "$BACKEND_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'The active backend release is not an exact lowercase commit SHA.' >&2
  exit 1
}

BACKEND_RELEASE_MARKER="$(get_parameter "/roadmap2u/${STAGE}/backend-releases/$BACKEND_RELEASE_SHA")"
test "$BACKEND_RELEASE_MARKER" = "$BACKEND_RELEASE_SHA"

BACKEND_RELEASE_MANIFEST="$(get_parameter "/roadmap2u/${STAGE}/backend-release-manifests/$BACKEND_RELEASE_SHA")"
jq -e --arg stage "$STAGE" --arg sha "$BACKEND_RELEASE_SHA" '
  type == "object" and
  .schemaVersion == 1 and
  .stage == $stage and
  .backendReleaseSha == $sha and
  (.handoff | type == "object") and
  (.handoff.region == "us-east-1") and
  ([
    .handoff.region,
    .handoff.userPoolId,
    .handoff.userPoolClientId,
    .handoff.apiBaseUrl,
    .handoff.frontendBucket,
    .handoff.cloudFrontDistributionId,
    .handoff.frontendUrl,
    .handoff.contractHash
  ] | all(.[]; type == "string" and length > 0 and (test("[\\r\\n]") | not))) and
  (.handoff.contractHash | test("^[0-9a-f]{64}$"))
' <<< "$BACKEND_RELEASE_MANIFEST" >/dev/null

# Fail if the pointer moved while the immutable manifest was being validated.
test "$(get_parameter "/roadmap2u/${STAGE}/backend-release-sha")" = "$BACKEND_RELEASE_SHA"

manifest_value() {
  jq -er ".handoff.$1" <<< "$BACKEND_RELEASE_MANIFEST"
}

{
  echo "region=$(manifest_value region)"
  echo "user_pool_id=$(manifest_value userPoolId)"
  echo "user_pool_client_id=$(manifest_value userPoolClientId)"
  echo "api_base_url=$(manifest_value apiBaseUrl)"
  echo "frontend_bucket=$(manifest_value frontendBucket)"
  echo "distribution_id=$(manifest_value cloudFrontDistributionId)"
  echo "frontend_url=$(manifest_value frontendUrl)"
  echo "contract_hash=$(manifest_value contractHash)"
  echo "backend_release_sha=$BACKEND_RELEASE_SHA"
} >> "$GITHUB_OUTPUT"
