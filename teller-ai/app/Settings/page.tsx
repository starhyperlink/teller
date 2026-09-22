"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import PayPalUpgradeButton from "@/components/PayPalUpgradeButton";

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const accountId = user?.sub || user?.email || "guest";
  const preferencesKey = `teller_preferences:${accountId}`;
  const [monthlyChatCount, setMonthlyChatCount] = useState(0);
  const [planName, setPlanName] = useState("Free");
  const [usageLimit, setUsageLimit] = useState(100);
  const [aiResponsesEnabled, setAiResponsesEnabled] = useState(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const accountProfile = {
    name: name || user?.name || "Teller User",
    email: user?.email || "user@example.com",
    picture:
      user?.picture ||
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
  };

  useEffect(() => {
    try {
      const storedPreferences = JSON.parse(localStorage.getItem(preferencesKey) || "null");
      if (storedPreferences) {
        setAiResponsesEnabled(storedPreferences.aiResponsesEnabled ?? true);
        setAutoScrollEnabled(storedPreferences.autoScrollEnabled ?? true);
      }
    } catch {
      setAiResponsesEnabled(true);
      setAutoScrollEnabled(true);
    }
  }, [preferencesKey]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const loadAccount = async () => {
      try {
        const token = await getAccessTokenSilently();
        const response = await fetch("/api/account", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const account = await response.json();
        setName(account.name || user?.name || "");
        setPhone(account.phone || "");
        setPlanName(account.plan);
        setUsageLimit(account.usageLimit);
        if (Number.isInteger(account.usageCount)) setMonthlyChatCount(account.usageCount);
      } catch {
      }
    };

    void loadAccount();
    window.addEventListener("focus", loadAccount);
    return () => window.removeEventListener("focus", loadAccount);
  }, [getAccessTokenSilently, isAuthenticated, isLoading, user]);

  async function saveProfile() {
    setIsSavingProfile(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, phone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update profile.");
      setName(result.name);
      setPhone(result.phone);
      setProfileMessage("Profile saved");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  function saveSettings() {
    localStorage.setItem(
      preferencesKey,
      JSON.stringify({ aiResponsesEnabled, autoScrollEnabled }),
    );
    setSaveMessage("Settings saved");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  if (isLoading) {
    return <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">Loading account...</main>;
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-4">
          <img
            src={accountProfile.picture}
            alt={accountProfile.name}
            className="h-14 w-14 rounded-full object-cover"
          />
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
              Profile
            </p>
            <h1 className="text-3xl font-bold">Account Settings</h1>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-lg font-semibold">Personal details</h2>
            <div className="mt-4 space-y-4 text-sm text-neutral-300">
              <label className="block">
                <span className="mb-2 block">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white disabled:opacity-60"
                />
              </label>
              <div className="border-b border-neutral-800 pb-3">
                <span>Email</span>
                <span className="float-right text-neutral-100">{accountProfile.email}</span>
              </div>
              <label className="block">
                <span className="mb-2 block">Phone</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={!isAuthenticated || isSavingProfile}
                  placeholder="Add a phone number"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white disabled:opacity-60"
                />
              </label>
              <div className="flex items-center justify-between">
                <span>Plan</span>
                <span className="text-neutral-100">{planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Chats this month</span>
                <span className="text-neutral-100">{monthlyChatCount}/{usageLimit}</span>
              </div>
            </div>
            {isAuthenticated && (
              <div className="mt-4 flex items-center justify-end gap-3">
                {profileMessage && <span className="text-sm text-emerald-400">{profileMessage}</span>}
                {profileError && <span className="text-sm text-red-400">{profileError}</span>}
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
                >
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            )}
          </section>

          {isAuthenticated && planName === "Free" && (
            <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <h2 className="text-lg font-semibold">Upgrade your plan</h2>
              <p className="mt-2 text-sm text-neutral-400">Unlock more messages and faster responses.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PayPalUpgradeButton
                  plan="pro-monthly"
                  className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black"
                >
                  Upgrade to Pro
                </PayPalUpgradeButton>
                <PayPalUpgradeButton
                  plan="business-monthly"
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  Upgrade to Business
                </PayPalUpgradeButton>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-lg font-semibold">Preferences</h2>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <label className="flex items-center justify-between gap-4">
                <span>AI responses in chat</span>
                <input
                  type="checkbox"
                  checked={aiResponsesEnabled}
                  onChange={(event) => setAiResponsesEnabled(event.target.checked)}
                  className="h-4 w-4 accent-white"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>Auto-scroll history</span>
                <input
                  type="checkbox"
                  checked={autoScrollEnabled}
                  onChange={(event) => setAutoScrollEnabled(event.target.checked)}
                  className="h-4 w-4 accent-white"
                />
              </label>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saveMessage && <span className="text-sm text-emerald-400">{saveMessage}</span>}
            <button
              type="button"
              onClick={saveSettings}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Save
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => logout({ logoutParams: { returnTo: typeof window !== "undefined" ? window.location.origin : undefined } })}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-white"
              >
                Log out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => loginWithRedirect()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
