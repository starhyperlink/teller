"use client";

import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function PayPalUpgradeButton({
  plan,
  className,
  children,
}: {
  plan: string;
  className: string;
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();

  async function handleUpgrade() {
    if (!isAuthenticated || !user?.sub) {
      await loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, userId: user.sub }),
      });
      const result = await response.json();

      if (!response.ok || !result.approvalUrl) {
        throw new Error(
          result.detail || result.error || "Could not start PayPal checkout."
        );
      }

      window.location.assign(result.approvalUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start PayPal checkout."
      );
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={isLoading}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {isLoading ? "Connecting to PayPal..." : children}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </>
  );
}