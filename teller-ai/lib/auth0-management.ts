const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;

function getManagementApiUrl(path: string) {
  if (!auth0Domain) throw new Error("NEXT_PUBLIC_AUTH0_DOMAIN is not configured.");
  return `https://${auth0Domain}/api/v2${path}`;
}

async function getManagementToken() {
  if (!auth0Domain || !process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_CLIENT_SECRET) {
    throw new Error("Auth0 Management API is not configured.");
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

  if (!response.ok) throw new Error("Auth0 Management API authentication failed.");
  const result = await response.json();
  return result.access_token as string;
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
    nickname?: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
  }>;
}

export async function updateAuth0Profile(
  userId: string,
  profile: { given_name: string; family_name: string; name: string },
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

  if (!response.ok) throw new Error("Could not update the Auth0 profile.");
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
  if (!authorization?.startsWith("Bearer ") || !auth0Domain) return null;

  const response = await fetch(`https://${auth0Domain}/userinfo`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.sub === "string" ? user.sub : null;
}