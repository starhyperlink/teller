import { createRemoteJWKSet, jwtVerify } from "jose";
import { LOCAL_TEST_ACCESS_TOKEN, LOCAL_TEST_USER_ID } from "@/lib/local-test-auth";

const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
let auth0Jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getManagementApiUrl(path: string) {
  if (!auth0Domain) throw new Error("NEXT_PUBLIC_AUTH0_DOMAIN is not configured.");
  return `https://${auth0Domain}/api/v2${path}`;
}

async function getManagementToken() {
  if (!auth0Domain || !process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_CLIENT_SECRET) {
    throw new Error(
      "Auth0 Management API is not configured. Set AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET for a server-side Machine-to-Machine application.",
    );
  }

  const response = await fetch(`https://${auth0Domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${auth0Domain}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });

  let result: { access_token?: unknown; error?: unknown; error_description?: unknown };
  try {
    result = await response.json();
  } catch {
    throw new Error(`Auth0 Management API token request failed (${response.status}) with an invalid response.`);
  }
  if (!response.ok) {
    const reason = typeof result.error_description === "string"
      ? result.error_description
      : typeof result.error === "string"
        ? result.error
        : "Auth0 rejected the client credentials.";
    throw new Error(
      `Auth0 Management API authentication failed (${response.status}): ${reason} Check the server-side AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET and authorize the Machine-to-Machine application for the Auth0 Management API.`,
    );
  }
  if (typeof result.access_token !== "string") {
    throw new Error("Auth0 Management API token response did not contain an access token.");
  }
  return result.access_token;
}

export async function getAuth0User(userId: string) {
  const token = await getManagementToken();
  const response = await fetch(getManagementApiUrl(`/users/${encodeURIComponent(userId)}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Could not load the Auth0 account.");
  return response.json() as Promise<{
    user_id: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    phone_number?: string;
    picture?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  }>;
}

export async function updateAuth0Profile(
  userId: string,
  profile: {
    name: string;
    given_name: string;
    family_name: string;
    phone_number?: string;
    user_metadata: Record<string, unknown>;
  }
) {
  const token = await getManagementToken();
  const response = await fetch(getManagementApiUrl(`/users/${encodeURIComponent(userId)}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Auth0 profile update failed (${response.status}): ${details}`);
  }
}

export async function updateAuth0Plan(
  userId: string,
  metadata: Record<string, string | number>
) {
  const token = await getManagementToken();
  const response = await fetch(getManagementApiUrl(`/users/${encodeURIComponent(userId)}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_metadata: metadata }),
  });

  if (!response.ok) throw new Error("Could not update the Auth0 account.");
}

export async function updateAuth0Usage(userId: string, usageCount: number, usageMonth: string) {
  const user = await getAuth0User(userId);
  await updateAuth0Plan(userId, {
    ...Object.fromEntries(
      Object.entries(user.app_metadata || {}).filter(
        ([, value]) => typeof value === "string" || typeof value === "number"
      )
    ),
    usage_count: usageCount,
    usage_month: usageMonth,
  });
}

export async function getAuthenticatedUserId(request: Request) {
  const authorization = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "development" &&
    authorization === `Bearer ${LOCAL_TEST_ACCESS_TOKEN}`
  ) {
    return LOCAL_TEST_USER_ID;
  }

  if (!authorization?.startsWith("Bearer ") || !auth0Domain) return null;

  const response = await fetch(`https://${auth0Domain}/userinfo`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });

  if (response.ok) {
    const user = await response.json();
    if (typeof user.sub === "string") return user.sub;
  }

  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  if (!audience) return null;

  try {
    auth0Jwks ??= createRemoteJWKSet(new URL(`https://${auth0Domain}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), auth0Jwks, {
      issuer: `https://${auth0Domain}/`,
      audience,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}