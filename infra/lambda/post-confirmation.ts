import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Deps, K, ProfileItem, TransactWriteCommand, realDeps } from './db';

/**
 * Cognito PostConfirmation → the DynamoDB profile item. Self-signup is always
 * an ADULT (minors are born via AdminCreateUser in family.createChild, which
 * writes its own profile). custom:accountType is stamped here — the client
 * never writes it (defense-in-depth; GET /me stays the authz truth).
 */
let deps: Deps | null = null;

export async function handleEvent(
  event: PostConfirmationTriggerEvent,
  injected?: Deps,
): Promise<PostConfirmationTriggerEvent> {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;
  const d = injected ?? (deps ??= realDeps());
  const sub = event.request.userAttributes['sub'];
  const username = event.userName.toLowerCase();

  const profile: ProfileItem = {
    ...K.profile(sub),
    userId: sub,
    username,
    displayName: event.request.userAttributes['name']?.trim() || username,
    accountType: 'adult',
    socialEnabled: true,
    createdAt: d.now(),
    email: event.request.userAttributes['email'],
  };
  await d.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: d.table, Item: profile } },
        // Cognito already guarantees login uniqueness; this guards the table
        // against races with admin-created usernames.
        { Put: { TableName: d.table, Item: { ...K.uniqUsername(username), userId: sub } } },
      ],
    }),
  );
  await d.cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      UserAttributes: [{ Name: 'custom:accountType', Value: 'adult' }],
    }),
  );
  return event;
}

export const handler = (event: PostConfirmationTriggerEvent) => handleEvent(event);
