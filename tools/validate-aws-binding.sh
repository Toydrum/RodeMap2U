#!/usr/bin/env bash

set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${SITE_BUCKET:?SITE_BUCKET is required}"
: "${DISTRIBUTION_ID:?DISTRIBUTION_ID is required}"
: "${FRONTEND_URL:?FRONTEND_URL is required}"

[[ "$AWS_REGION" == us-east-1 ]] || {
  echo "Expected AWS_REGION us-east-1, received $AWS_REGION." >&2
  exit 1
}

frontend_host="${FRONTEND_URL#https://}"
expected_origin="$SITE_BUCKET.s3.$AWS_REGION.amazonaws.com"

distribution_enabled="$(aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query 'Distribution.DistributionConfig.Enabled' \
  --output text)"
[[ "$distribution_enabled" == True ]] || {
  echo "CloudFront distribution $DISTRIBUTION_ID is not enabled." >&2
  exit 1
}

aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query 'Distribution.DistributionConfig.Aliases.Items' \
  --output text |
  tr '\t' '\n' |
  grep -F -x -- "$frontend_host" >/dev/null || {
  echo "CloudFront distribution $DISTRIBUTION_ID does not own alias $frontend_host." >&2
  exit 1
}

aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query 'Distribution.DistributionConfig.Origins.Items[].DomainName' \
  --output text |
  tr '\t' '\n' |
  grep -F -x -- "$expected_origin" >/dev/null || {
  echo "CloudFront distribution $DISTRIBUTION_ID is not bound to $expected_origin." >&2
  exit 1
}

origin_access_control_id="$(aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query "Distribution.DistributionConfig.Origins.Items[?DomainName=='$expected_origin'].OriginAccessControlId | [0]" \
  --output text)"
[[ -n "$origin_access_control_id" && "$origin_access_control_id" != None && "$origin_access_control_id" != null ]] || {
  echo "CloudFront origin $expected_origin has no Origin Access Control." >&2
  exit 1
}

bucket_region="$(aws s3api get-bucket-location \
  --bucket "$SITE_BUCKET" \
  --query 'LocationConstraint' \
  --output text)"
[[ "$bucket_region" == None || "$bucket_region" == null || "$bucket_region" == us-east-1 ]] || {
  echo "Bucket $SITE_BUCKET is not in us-east-1 (received $bucket_region)." >&2
  exit 1
}
