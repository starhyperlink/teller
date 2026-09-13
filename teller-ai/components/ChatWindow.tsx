"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  file?: {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  } | null;
};

type HistoryItem = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type Theme = "auto" | "dark" | "light";

function getUsageMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
    },
  ]);

  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [pendingFile, setPendingFile] = useState<Message["file"] | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("auto");
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const { user, isAuthenticated, isLoading: isAuthLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const accountId = user?.sub || user?.email || "guest";
  const historyStorageKey = `teller_histories:${accountId}`;
  const usageStorageKey = `teller_usage:${accountId}:${getUsageMonth()}`;
  const [monthlyChatCount, setMonthlyChatCount] = useState(0);
  const [planName, setPlanName] = useState("Free");
  const [usageLimit, setUsageLimit] = useState(100);
  const accountProfile = {
    name: user?.name || "Teller User",
    email: user?.email || "user@example.com",
    picture:
      user?.picture ||
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    isAuthenticated,
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("teller_theme") as Theme | null;
    if (savedTheme === "auto" || savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("teller_theme", theme);
  }, [theme]);

  function playReplySound() {
    try {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.16);
      oscillator.addEventListener("ended", () => void audioContext.close());
    } catch {}
  }

  // Load only the current account's histories and monthly usage.
  useEffect(() => {
    if (isAuthLoading) return;

    try {
      setActiveHistoryId(null);
      setMessages([
        {
          role: "assistant",
          content:
            "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
        },
      ]);
      const raw = localStorage.getItem(historyStorageKey);
      const storedUsage = Number(localStorage.getItem(usageStorageKey) || "0");
      setMonthlyChatCount(Number.isFinite(storedUsage) ? storedUsage : 0);

      if (raw) {
        const parsed: HistoryItem[] = JSON.parse(raw);
        const sorted = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        setHistories(sorted);
        if (sorted.length) {
          setActiveHistoryId(sorted[0].id);
          setMessages(sorted[0].messages);
          return;
        }
      }

      // initialize with default assistant message as a new history
      const initialMessages: Message[] = [
        {
          role: "assistant",
          content:
            "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
        },
      ];
      const id = Date.now().toString();
      const initial: HistoryItem = {
        id,
        title: "New chat",
        messages: initialMessages,
        updatedAt: Date.now(),
      };
      setHistories([initial]);
      setActiveHistoryId(id);
      setMessages(initialMessages);
      localStorage.setItem(historyStorageKey, JSON.stringify([initial]));
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }, [historyStorageKey, isAuthLoading, usageStorageKey]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently()
      .then((token) => fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } }))
      .then((response) => (response.ok ? response.json() : null))
      .then((account) => {
        if (!account) return;
        setPlanName(account.plan);
        setUsageLimit(account.usageLimit);
        if (Number.isInteger(account.usageCount)) {
          setMonthlyChatCount(account.usageCount);
          localStorage.setItem(usageStorageKey, String(account.usageCount));
        }
      })
      .catch(() => undefined);
  }, [getAccessTokenSilently, isAuthenticated]);

  // Persist active history whenever messages change
  useEffect(() => {
    if (!activeHistoryId) return;
    setHistories((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((h) => h.id === activeHistoryId);
      const titleFromUser = messages.find((m) => m.role === "user")?.content?.slice(0, 60) || "New chat";
      // If there's an existing non-default title (likely AI-generated), preserve it.
      const existing = prev.find((h) => h.id === activeHistoryId);
      const finalTitle = existing && existing.title && existing.title !== "New chat" ? existing.title : titleFromUser;
      const updated: HistoryItem = {
        id: activeHistoryId,
        title: finalTitle,
        messages,
        updatedAt: Date.now(),
      };
      if (idx === -1) next.unshift(updated);
      else {
        next[idx] = updated;
        next.splice(idx, 1);
        next.unshift(updated);
      }
      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, [messages, activeHistoryId, historyStorageKey]);

  function createNewChat() {
    const id = Date.now().toString();
    const initialMessages: Message[] = [
      {
        role: "assistant",
        content:
          "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
      },
    ];
    const newItem: HistoryItem = {
      id,
      title: "New chat",
      messages: initialMessages,
      updatedAt: Date.now(),
    };
    const next = [newItem, ...histories];
    setHistories(next);
    setActiveHistoryId(id);
    setMessages(initialMessages);
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(next));
    } catch (e) {}
    setIsSidebarOpen(false);
  }

  function openUserPanel() {
    const userPanelUrl = `${window.location.origin}/Settings`;
    window.open(userPanelUrl, "_blank", "noopener,noreferrer");
  }

  function deleteHistory(id: string) {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    setHistories((prev) => {
      const next = prev.filter((h) => h.id !== id);
      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(next));
      } catch (e) {}

      // if deleted active, switch to first or create new
      if (id === activeHistoryId) {
        if (next.length) {
          setActiveHistoryId(next[0].id);
          setMessages(next[0].messages);
        } else {
          const newId = Date.now().toString();
          const initialMessages: Message[] = [
            { role: "assistant", content: "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.", file: null },
          ];
          const newHist: HistoryItem = { id: newId, title: "New chat", messages: initialMessages, updatedAt: Date.now() };
          setHistories([newHist]);
          setActiveHistoryId(newId);
          setMessages(initialMessages);
        }
      }
      return next;
    });
  }

  function loadHistory(id: string) {
    const h = histories.find((x) => x.id === id);
    if (!h) return;
    setActiveHistoryId(id);
    setMessages(h.messages);
    setIsSidebarOpen(false);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    if (monthlyChatCount >= usageLimit) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      file: pendingFile,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    const nextMonthlyChatCount = monthlyChatCount + 1;
    setMonthlyChatCount(nextMonthlyChatCount);
    localStorage.setItem(usageStorageKey, String(nextMonthlyChatCount));

    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((token) =>
          fetch("/api/account/usage", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ usageCount: nextMonthlyChatCount }),
          })
        )
        .catch(() => undefined);
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // include file data inline for the API if present
          messages: updatedMessages.map((msg) => {
            if (msg.file) {
              return {
                role: msg.role,
                content: `File: ${msg.file.name} (${msg.file.type}; ${msg.file.size} bytes)\n${msg.file.dataUrl}\n${msg.content || ""}`,
              };
            }
            return { role: msg.role, content: msg.content };
          }),
        }),
      });

      const data = await response.json();

      if (data.reply) {
        const assistantMessage: Message = { role: "assistant", content: data.reply, file: null };
        setMessages([...updatedMessages, assistantMessage]);
        playReplySound();

        // If the server returned a suggested title, update the active history
        if (data.title && activeHistoryId) {
          setHistories((prev) => {
            const next = prev.slice();
            const idx = next.findIndex((h) => h.id === activeHistoryId);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                title: data.title,
                messages: [...updatedMessages, assistantMessage],
                updatedAt: Date.now(),
              };
              const item = next.splice(idx, 1)[0];
              next.unshift(item);
            } else {
              next.unshift({ id: activeHistoryId, title: data.title, messages: [...updatedMessages, assistantMessage], updatedAt: Date.now() });
            }
            try {
              localStorage.setItem(historyStorageKey, JSON.stringify(next));
            } catch (e) {}
            return next;
          });
        } else if (activeHistoryId) {
          // If the active history still has the default title, generate one now
          const current = histories.find((h) => h.id === activeHistoryId);
          if (current && (!current.title || current.title === "New chat")) {
            (async () => {
              try {
                const res = await fetch("/api/title", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ messages: [...updatedMessages, { role: "assistant", content: data.reply }] }),
                });
                const d = await res.json();
                if (d.title) {
                  setHistories((prev) => {
                    const next = prev.slice();
                    const idx = next.findIndex((h) => h.id === activeHistoryId);
                    if (idx !== -1) {
                      next[idx] = { ...next[idx], title: d.title, messages: [...updatedMessages, { role: "assistant", content: data.reply }], updatedAt: Date.now() };
                      const item = next.splice(idx, 1)[0];
                      next.unshift(item);
                    }
                    try {
                      localStorage.setItem(historyStorageKey, JSON.stringify(next));
                    } catch (e) {}
                    return next;
                  });
                }
              } catch (e) {}
            })();
          }
        }
      } else {
        setMessages([...updatedMessages, { role: "assistant", content: "Sorry, something went wrong.", file: null }]);
      }
    } catch (err) {
      setMessages([...updatedMessages, { role: "assistant", content: "Network error. Please try again.", file: null }]);
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  return (
    <div data-theme={theme} className="flex h-screen bg-neutral-950 text-white">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-neutral-800 bg-neutral-900 p-4 transition-transform duration-200 md:static md:translate-x-0 ${isHistoryVisible ? 'md:block' : 'md:hidden'} ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`} aria-hidden={!isSidebarOpen && true}>
        <div className="flex h-full flex-col">
          <div className="mb-4">
            <h1 className="mb-2 flex items-center justify-between text-2xl font-bold">
              Teller AI
              <button className="ml-2 rounded bg-neutral-800 px-2 py-1 text-sm md:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
                ✕
              </button>
            </h1>

            <button className="mb-2 w-full rounded-lg bg-white px-4 py-2 font-medium text-black" onClick={createNewChat}>
              New Chat
            </button>

            {/* file attach control moved to the input area (left of prompt) */}

            {/* Titles are generated automatically after the first assistant reply; removed manual button */}
          </div>

          {isAuthenticated && (
            <div className="overflow-y-auto flex-1 space-y-2 text-sm text-neutral-400 modern-scroll">
              {histories.length === 0 && <p>No chats yet</p>}

              {histories.slice(0, 6).map((h) => (
                <div key={h.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') loadHistory(h.id); }} onClick={() => loadHistory(h.id)} className={`flex items-center justify-between w-full rounded-md px-3 py-2 hover:bg-neutral-800 ${h.id === activeHistoryId ? "bg-neutral-800" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate text-white">{h.title}</div>
                    <div className="mt-1 text-xs text-neutral-400">{new Date(h.updatedAt).toLocaleString()}</div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); deleteHistory(h.id); }} className="rounded px-2 py-1 text-xs bg-neutral-800">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Profile / user management at bottom */}
          <div className="mt-4 border-t border-neutral-800 pt-3">
            {isAuthLoading ? (
              <div className="px-3 py-2 text-sm text-neutral-400">Loading account...</div>
            ) : isAuthenticated ? (
              <>
                <button onClick={() => setIsProfileOpen((s) => !s)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 hover:bg-neutral-800">
                  <img
                    src={accountProfile.picture}
                    alt={accountProfile.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 text-left">
                    <div className="truncate text-white">{accountProfile.name}</div>
                    <div className="text-xs text-neutral-400">{accountProfile.email}</div>
                  </div>
                  <div className="text-neutral-400">{isProfileOpen ? '▾' : '▸'}</div>
                </button>

                {isProfileOpen && (
                  <div className="mt-2 space-y-2 text-sm">
                    <button type="button" onClick={openUserPanel} className="w-full rounded px-3 py-2 text-left hover:bg-neutral-800">Account Settings</button>
                    <button type="button" onClick={() => loginWithRedirect()} className="w-full rounded px-3 py-2 text-left hover:bg-neutral-800">Switch account</button>
                    <button type="button" onClick={() => logout({ logoutParams: { returnTo: typeof window !== "undefined" ? window.location.origin : undefined } })} className="w-full rounded px-3 py-2 text-left hover:bg-neutral-800">Log out</button>
                  </div>
                )}
              </>
            ) : (
              <button type="button" onClick={() => loginWithRedirect()} className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black">
                Log in
              </button>
            )}
            {isAuthenticated && (
              <div className="mt-3 px-3 text-xs text-neutral-400">
                {planName} plan: {monthlyChatCount}/{usageLimit} chats this month
              </div>
            )}
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden />}

      <main className="flex flex-1 flex-col">
        <header className="border-b border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="rounded-md bg-neutral-800 px-3 py-2 text-sm md:hidden" onClick={() => setIsSidebarOpen((s) => !s)} aria-label="Toggle sidebar">Menu</button>
              <button className="hidden items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm md:inline-flex" onClick={() => setIsHistoryVisible((v) => !v)} aria-label="Toggle history visibility">
                Menu
              </button>
              <h2 className="text-lg font-semibold">Teller AI Chat</h2>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen((open) => !open)}
                className="rounded-md bg-neutral-800 px-3 py-2 text-sm"
                aria-label="Change theme"
                aria-expanded={isThemeMenuOpen}
              >
                Theme: {theme[0].toUpperCase() + theme.slice(1)}
              </button>
              {isThemeMenuOpen && (
                <div className="absolute right-0 top-11 z-20 w-36 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
                  {(["auto", "dark", "light"] as Theme[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setTheme(option);
                        setIsThemeMenuOpen(false);
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-sm capitalize hover:bg-neutral-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 modern-scroll">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`max-w-[85%] rounded-xl p-4 ${message.role === "user" ? "ml-auto bg-blue-600" : "mr-auto bg-neutral-800"}`}>
                {message.file && (
                  <div className="mb-2">
                    {message.file.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={message.file.dataUrl} alt={message.file.name} className="max-h-48 w-auto rounded" />
                    ) : (
                      <a href={message.file.dataUrl} download={message.file.name} className="underline">Download {message.file.name}</a>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}

            {loading && (
              <div className="mr-auto max-w-[85%] rounded-xl bg-neutral-800 p-4">Teller AI is thinking...</div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-neutral-800 p-4">
          <div className="mx-auto max-w-3xl">
            {isAuthenticated ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-800 text-xl" title="Attach file">
                  <input type="file" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result as string;
                      setPendingFile({ name: f.name, type: f.type, size: f.size, dataUrl });
                    };
                    reader.readAsDataURL(f);
                  }} />
                  📎
                </label>

                <input className="min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 outline-none" placeholder="Ask Teller AI anything..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />

                <button onClick={sendMessage} disabled={loading} className="shrink-0 rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">Send</button>
              </div>
            ) : (
              <button type="button" onClick={() => loginWithRedirect()} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800">
                Log in to attach files and send messages
              </button>
            )}
          </div>
          {pendingFile && (
            <div className="mx-auto mt-2 flex max-w-3xl items-center text-sm text-neutral-300">
              Attached: <span className="ml-2 truncate">{pendingFile.name}</span>
              <button className="ml-3 rounded bg-neutral-800 px-2 py-1 text-xs" onClick={() => setPendingFile(null)}>Remove</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
