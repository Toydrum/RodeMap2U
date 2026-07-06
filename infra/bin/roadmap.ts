import { App } from 'aws-cdk-lib';
import { RoadmapStack } from '../lib/roadmap-stack';

const app = new App();
new RoadmapStack(app, 'Roadmap', {
  description: 'RoadMap2U backend: Cognito + DynamoDB + HTTP API + router Lambda (docs/backend-contract.md)',
  // Region/account come from the CLI profile at deploy time; synth is env-agnostic.
});
