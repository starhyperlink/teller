"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { useEffect, type ReactNode } from "react";
import { getFirebaseAnalytics } from "@/lib/firebase";

const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "example.auth0.com";
const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "placeholder-client-id";
const configuredCallbackUrl = process.env.NEXT_PUBLIC_AUTH0_CALLBACK_URL;
const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

export function AppAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void getFirebaseAnalytics();
  }, []);

  const redirectUri =
    configuredCallbackUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/`
      : "http://localhost:3000/");

  function handleRedirectCallback() {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, "/Settings");
    }
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
        scope: "openid profile email",
      }}
      onRedirectCallback={handleRedirectCallback}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
