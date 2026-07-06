import { App } from 'aws-cdk-lib';
import { RodemapStack } from '../lib/rodemap-stack';

const app = new App();
new RodemapStack(app, 'Rodemap', {
  description: 'RodeMap2U backend: Cognito + DynamoDB + HTTP API + router Lambda (docs/backend-contract.md)',
  // Region/account come from the CLI profile at deploy time; synth is env-agnostic.
});
