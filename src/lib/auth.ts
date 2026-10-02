// src/lib/auth.ts — Amazon Cognito via Amplify Auth. Configured from Amplify env vars.
import { Amplify } from "aws-amplify";
import { fetchAuthSession, signOut as amplifySignOut } from "aws-amplify/auth";

const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;

export const authEnabled = !!(poolId && clientId);

if (authEnabled) {
  Amplify.configure({
    Auth: { Cognito: { userPoolId: poolId!, userPoolClientId: clientId!, loginWith: { email: true } } },
  });
}

/** ID token for API Gateway's Cognito authorizer, or null when signed out / auth disabled. */
export async function getIdToken(): Promise<string | null> {
  if (!authEnabled) return null;
  try {
    const s = await fetchAuthSession();
    return s.tokens?.idToken?.toString() ?? null;
  } catch { return null; }
}

export async function signOut() {
  if (authEnabled) await amplifySignOut();
}
