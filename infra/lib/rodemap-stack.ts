import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PASSWORD_POLICY } from '@app/auth/auth-types';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The whole RodeMap2U backend — implements docs/backend-contract.md verbatim.
 * `cdk deploy` prints the exact APP_CONFIG.aws strings as outputs; pasting
 * them into src/app/core/config.ts and flipping backend to 'aws' IS the
 * client migration (runbook: docs/aws-connect.md).
 */
export class RodemapStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ── Identity — the pool checklist from cognito-auth.provider.ts ────────
    const postConfirmation = new NodejsFunction(this, 'PostConfirmation', {
      entry: join(here, '../lambda/post-confirmation.ts'),
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: { format: OutputFormat.ESM, tsconfig: join(here, '../tsconfig.json'), target: 'node22' },
    });

    const pool = new cognito.UserPool(this, 'Users', {
      userPoolName: 'rodemap-users',
      selfSignUpEnabled: true, // adults; minors are born via AdminCreateUser
      signInAliases: { username: true, email: true },
      signInCaseSensitive: false,
      standardAttributes: {
        email: { required: false, mutable: true }, // minors have none
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        // Backend-written only (PostConfirmation / AdminCreateUser).
        accountType: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: PASSWORD_POLICY.minLength,
        requireLowercase: PASSWORD_POLICY.requireLower,
        requireUppercase: PASSWORD_POLICY.requireUpper,
        requireDigits: PASSWORD_POLICY.requireDigit,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: { emailStyle: cognito.VerificationEmailStyle.CODE }, // never links
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lambdaTriggers: { postConfirmation },
    });

    const webClient = pool.addClient('Web', {
      userPoolClientName: 'rodemap-web',
      generateSecret: false, // browser SPA
      authFlows: { userSrp: true }, // SRP only — no USER_PASSWORD, no OAuth
      preventUserExistenceErrors: true, // no account-enumeration oracle
      refreshTokenValidity: Duration.days(30),
    });

    // ── Data — single table per backend-contract.md §6 ─────────────────────
    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'rodemap',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'gsi1', // guardian→minors · outgoing friend requests
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
    });
    table.addGlobalSecondaryIndex({
      indexName: 'gsi2', // per-user change feed, ordered by server receive time
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
    });

    // ── The router Lambda ───────────────────────────────────────────────────
    const router = new NodejsFunction(this, 'Router', {
      entry: join(here, '../lambda/router.ts'),
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(15),
      environment: { TABLE_NAME: table.tableName, USER_POOL_ID: pool.userPoolId },
      bundling: { format: OutputFormat.ESM, tsconfig: join(here, '../tsconfig.json'), target: 'node22' },
    });
    table.grantReadWriteData(router);
    router.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminDeleteUser',
        ],
        resources: [pool.userPoolArn],
      }),
    );

    table.grantWriteData(postConfirmation);
    postConfirmation.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminUpdateUserAttributes'],
        resources: [pool.userPoolArn],
      }),
    );

    // ── HTTP API — JWT authorizer validates ID tokens (aud = client id) ────
    const api = new HttpApi(this, 'Api', {
      apiName: 'rodemap-api',
      corsPreflight: {
        // Missing CORS is the #1 mock-works-but-AWS-doesn't failure — see
        // docs/aws-connect.md §3. Origins: prod Pages + dev servers.
        allowOrigins: [
          'https://toydrum.github.io',
          'http://localhost:4200',
          'http://localhost:8826',
        ],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.days(1),
      },
    });
    const authorizer = new HttpJwtAuthorizer(
      'CognitoJwt',
      `https://cognito-idp.${this.region}.amazonaws.com/${pool.userPoolId}`,
      { jwtAudience: [webClient.userPoolClientId] },
    );
    api.addRoutes({
      path: '/v1/{proxy+}',
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration('RouterIntegration', router),
      authorizer,
    });

    // ── The five strings for src/app/core/config.ts ────────────────────────
    new CfnOutput(this, 'ConfigRegion', { value: this.region });
    new CfnOutput(this, 'ConfigUserPoolId', { value: pool.userPoolId });
    new CfnOutput(this, 'ConfigUserPoolClientId', { value: webClient.userPoolClientId });
    new CfnOutput(this, 'ConfigApiBaseUrl', { value: api.apiEndpoint }); // WITHOUT /v1
  }
}
