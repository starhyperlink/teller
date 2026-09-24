"use client";

import { useAuth0 } from "@auth0/auth0-react";
import PayPalUpgradeButton from "@/components/PayPalUpgradeButton";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  file?: {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
    storagePath?: string;
  } | null;
};

type HistoryItem = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type Theme = "auto" | "dark" | "light";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "The request failed.";
}

function normalizeMathExpression(expression: string) {
  let normalized = expression.trim();

  const greekMap: Record<string, string> = {
    α: "\\alpha",
    β: "\\beta",
    γ: "\\gamma",
    δ: "\\delta",
    ε: "\\epsilon",
    θ: "\\theta",
    λ: "\\lambda",
    μ: "\\mu",
    π: "\\pi",
    ρ: "\\rho",
    σ: "\\sigma",
    τ: "\\tau",
    φ: "\\phi",
    χ: "\\chi",
    ψ: "\\psi",
    ω: "\\omega",
    Δ: "\\Delta",
    Θ: "\\Theta",
    Λ: "\\Lambda",
    Π: "\\Pi",
    Σ: "\\Sigma",
    Φ: "\\Phi",
    Ω: "\\Omega",
  };
  Object.entries(greekMap).forEach(([symbol, latex]) => {
    normalized = normalized.replaceAll(symbol, latex);
  });

  normalized = normalized
    .replace(/×/g, " \\times ")
    .replace(/÷/g, " \\div ")
    .replace(/±/g, " \\pm ")
    .replace(/∞/g, "\\infty")
    .replace(/°/g, "^\\circ")
    .replace(/∂/g, "\\partial")
    .replace(/∫/g, "\\int")
    .replace(/∑/g, "\\sum")
    .replace(/∏/g, "\\prod")
    .replace(/√/g, "\\sqrt")
    .replace(/≈/g, "\\approx")
    .replace(/≠/g, "\\neq")
    .replace(/≤/g, "\\leq")
    .replace(/≥/g, "\\geq")
    .replace(/→/g, "\\rightarrow")
    .replace(/∀/g, "\\forall")
    .replace(/∃/g, "\\exists")
    .replace(/∈/g, "\\in")
    .replace(/⊆/g, "\\subseteq")
    .replace(/\s*\^\s*\{/g, "^\{")
    .replace(/([0-9]+(?:\.[0-9]+)?)\s*e\s*([-+]?\d+)/gi, (_, coefficient: string, exponent: string) => `${coefficient} \\times 10^{${exponent}}`)
    .replace(/([0-9]+(?:\.[0-9]+)?)\s*×\s*10\^\{?([-+]?\d+)\}?/gi, (_, coefficient: string, exponent: string) => `${coefficient} \\times 10^{${exponent}}`);

  return normalized;
}

function renderMathExpression(expression: string, displayMode: boolean) {
  const normalizedExpression = normalizeMathExpression(expression);

  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(normalizedExpression, {
          displayMode,
          throwOnError: false,
          output: "htmlAndMathml",
          strict: "ignore",
        }),
      }}
    />
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g);

  return tokens.map((part, index) => {
    if (!part) return null;

    if (part.match(/^\$\$[\s\S]+?\$\$$/)) {
      return <span key={index} className="my-2 block text-center">{renderMathExpression(part.slice(2, -2), true)}</span>;
    }
    if (part.match(/^\$[^$\n]+?\$$/)) {
      return <span key={index} className="inline-block align-middle text-sky-200">{renderMathExpression(part.slice(1, -1), false)}</span>;
    }
    if (part.match(/^\\\([\s\S]+?\\\)$/)) {
      return <span key={index} className="inline-block align-middle text-sky-200">{renderMathExpression(part.slice(2, -2), false)}</span>;
    }
    if (part.match(/^\\\[[\s\S]+?\\\]$/)) {
      return <span key={index} className="my-2 block text-center">{renderMathExpression(part.slice(2, -2), true)}</span>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-200">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

function renderMathBlock(block: string, key: string): ReactNode {
  const stripped = block.replace(/^\s*\$\$\s*|\s*\$\$\s*$/g, "").replace(/^\s*\\\[\s*|\s*\\\]\s*$/g, "");
  return (
    <div key={key} className="my-3 overflow-x-auto rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-center text-sky-100">
      {renderMathExpression(stripped, true)}
    </div>
  );
}

function FormattedMessage({ content, onCopyCode, showCodeCopy = true }: { content: string; onCopyCode: (code: string) => void; showCodeCopy?: boolean }) {
  const blocks = content.split(/```([\w+-]*)\n?([\s\S]*?)```/g);
  const output: ReactNode[] = [];

  for (let index = 0; index < blocks.length; index += 3) {
    const text = blocks[index];
    if (text) {
      const mathSegments = text.split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g);
      mathSegments.forEach((segment, segmentIndex) => {
        if (!segment) return;

        if (segment.match(/^\$\$[\s\S]+?\$\$$/) || segment.match(/^\\\[[\s\S]+?\\\]$/)) {
          output.push(renderMathBlock(segment, `${index}-${segmentIndex}`));
          return;
        }

        segment.split("\n").forEach((line, lineIndex) => {
          const heading = line.match(/^(#{1,3})\s+(.+)$/);
          const bullet = line.match(/^\s*[-*]\s+(.+)$/);
          const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
          if (heading) output.push(<h3 key={`${index}-${segmentIndex}-${lineIndex}`} className="mt-3 text-base font-semibold text-white">{renderInlineMarkdown(heading[2])}</h3>);
          else if (bullet) output.push(<div key={`${index}-${segmentIndex}-${lineIndex}`} className="pl-4 before:mr-2 before:content-['•']">{renderInlineMarkdown(bullet[1])}</div>);
          else if (numbered) output.push(<div key={`${index}-${segmentIndex}-${lineIndex}`} className="pl-4">{renderInlineMarkdown(line.trim())}</div>);
          else output.push(<span key={`${index}-${segmentIndex}-${lineIndex}`}>{renderInlineMarkdown(line)}{lineIndex < segment.split("\n").length - 1 && <br />}</span>);
        });
      });
    }
    if (index + 1 < blocks.length) {
      const language = blocks[index + 1] || "code";
      const code = blocks[index + 2].trim();
      output.push(
        <div key={`code-${index}`} className="my-3 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
          <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-xs text-neutral-400">
            <span>{language}</span>
            {showCodeCopy && <button type="button" onClick={() => onCopyCode(code)} className="rounded bg-neutral-800 px-2 py-1 text-xl leading-none text-neutral-200 hover:bg-neutral-700" aria-label="Copy code" title="Copy code">⧉</button>}
          </div>
          <pre className="overflow-x-auto p-3 text-xs leading-6 text-emerald-100"><code>{code}</code></pre>
        </div>,
      );
    }
  }
  return output;
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
  const historyHydratedRef = useRef(false);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [pendingFile, setPendingFile] = useState<Message["file"] | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("auto");
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { user, isAuthenticated, isLoading: isAuthLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const authReady = isMounted && !isAuthLoading;
  const hasSession = authReady && isAuthenticated;
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
    setIsMounted(true);
  }, []);

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

    historyHydratedRef.current = false;
    try {
      setActiveHistoryId(null);
      setMessages([
        {
          role: "assistant",
          content:
            "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
        },
      ]);
      if (!isAuthenticated) {
        const initialMessages: Message[] = [
          {
            role: "assistant",
            content:
              "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
          },
        ];
        const initial: HistoryItem = {
          id: Date.now().toString(),
          title: "New chat",
          messages: initialMessages,
          updatedAt: Date.now(),
        };
        setHistories([initial]);
        setActiveHistoryId(initial.id);
        setMessages(initialMessages);
        setMonthlyChatCount(0);
        historyHydratedRef.current = true;
        return;
      }

      getAccessTokenSilently()
        .then((token) => fetch("/api/account/history", { headers: { Authorization: `Bearer ${token}` } }))
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not load remote history.");
          const data = await response.json();
          if (!Array.isArray(data.history)) throw new Error("Invalid remote history.");
          const remoteHistories = data.history as HistoryItem[];
          if (remoteHistories.length) {
            setHistories(remoteHistories);
            setActiveHistoryId(remoteHistories[0].id);
            setMessages(remoteHistories[0].messages);
          } else {
            const initialMessages: Message[] = [
              {
                role: "assistant",
                content:
                  "Hi, I’m Teller AI. Ask me anything — I can help with research, writing, business, coding, summaries, and ideas.",
              },
            ];
            const initial: HistoryItem = {
              id: Date.now().toString(),
              title: "New chat",
              messages: initialMessages,
              updatedAt: Date.now(),
            };
            setHistories([initial]);
            setActiveHistoryId(initial.id);
            setMessages(initialMessages);
          }
        })
        .catch(() => {
          setHistories([]);
          setActiveHistoryId(null);
        })
        .finally(() => {
          historyHydratedRef.current = true;
        });
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }, [getAccessTokenSilently, isAuthLoading, isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    getAccessTokenSilently()
      .then((token) => fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } }))
      .then((response) => (response.ok ? response.json() : null))
      .then((account) => {
        if (!account) return;
        setPlanName(account.plan);
        setUsageLimit(account.usageLimit);
        if (Number.isInteger(account.usageCount)) {
          setMonthlyChatCount(account.usageCount);
        }
      })
      .catch(() => undefined);
  }, [getAccessTokenSilently, isAuthLoading, isAuthenticated]);

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
      return next;
    });
  }, [messages, activeHistoryId]);

  useEffect(() => {
    if (!isAuthenticated || !historyHydratedRef.current) return;
    let cancelled = false;
    getAccessTokenSilently()
      .then((token) =>
        fetch("/api/account/history", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ history: histories }),
        }),
      )
      .then((response) => {
        if (!response.ok && !cancelled) throw new Error("Could not save remote history.");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently, histories, isAuthenticated]);

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

    try {
      const token = isAuthenticated ? await getAccessTokenSilently() : null;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages.map((msg) => {
            if (msg.file) {
              return {
                role: msg.role,
                content: `${msg.content || ""}\n[Attachment: ${msg.file.name} (${msg.file.type}; ${msg.file.size} bytes)]`,
              };
            }
            return { role: msg.role, content: msg.content };
          }),
        }),
      });

      const data = await response.json();

      const hasServerUsageCount = Number.isInteger(data.usageCount);
      if (hasServerUsageCount) {
        setMonthlyChatCount(data.usageCount);
      }

      if (data.reply) {
        if (isAuthenticated && !hasServerUsageCount) {
          setMonthlyChatCount((count) => count + 1);
        }
        const assistantMessage: Message = { role: "assistant", content: data.reply, imageUrl: data.imageUrl || undefined, file: null };
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
                  body: JSON.stringify({
                    messages: [
                      ...updatedMessages.map((msg) => ({
                        role: msg.role,
                        content: msg.file
                          ? `${msg.content || ""}\n[Attachment: ${msg.file.name} (${msg.file.type}; ${msg.file.size} bytes)]`
                          : msg.content,
                      })),
                      { role: "assistant", content: data.reply },
                    ],
                  }),
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
      const errorMessage = getErrorMessage(err) || "Network error. Please try again.";
      setMessages([...updatedMessages, { role: "assistant", content: errorMessage, file: null }]);
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedMessage(index);
    window.setTimeout(() => setCopiedMessage((current) => current === index ? null : current), 1400);
  }

  function editMessage(message: Message, index: number) {
    const editedMessages = messages.slice(0, index);
    setMessages(editedMessages);
    if (activeHistoryId) {
      setHistories((previous) => previous.map((history) => (
        history.id === activeHistoryId
          ? { ...history, messages: editedMessages, updatedAt: Date.now() }
          : history
      )));
    }
    setInput(message.content);
    setPendingFile(message.file || null);
    window.setTimeout(() => document.querySelector<HTMLInputElement>("input[placeholder='Ask Teller AI anything...']")?.focus(), 0);
  }

  return (
    <div data-theme={theme} className="flex h-screen bg-neutral-950 text-white">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-neutral-800 bg-neutral-900 p-4 transition-transform duration-200 md:static md:translate-x-0 ${isHistoryVisible ? 'md:block' : 'md:hidden'} ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`} aria-hidden={!isSidebarOpen && true}>
        <div className="flex h-full flex-col">
          <div className="mb-4">
            <h1 className="relative mb-2 flex items-center justify-center text-2xl font-bold">
              <img src="/jupiter-black.svg" alt="Jupiter" className="h-16 w-16 object-contain" />
              <button className="absolute right-0 rounded bg-neutral-800 px-2 py-1 text-sm md:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
                ✕
              </button>
            </h1>

            <button className="mb-2 w-full rounded-lg bg-white px-4 py-2 font-medium text-black" onClick={createNewChat}>
              New Chat
            </button>

            {/* file attach control moved to the input area (left of prompt) */}

            {/* Titles are generated automatically after the first assistant reply; removed manual button */}
          </div>

          {hasSession && (
            <div className="min-h-0 flex-1 overflow-y-auto space-y-5 text-sm text-neutral-400 modern-scroll">
              <section aria-labelledby="chat-history-heading">
                <h2 id="chat-history-heading" className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Chat history</h2>
                {histories.length === 0 && <p className="px-1">No chats yet</p>}
                <div className="space-y-2">
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
              </section>

            </div>
          )}
          {/* Profile / user management at bottom */}
          <div className="mt-4 border-t border-neutral-800 pt-3">
            {isAuthLoading ? (
              <div className="px-3 py-2 text-sm text-neutral-400">Loading account...</div>
            ) : hasSession ? (
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
                    <button type="button" onClick={() => {
                      void logout({ logoutParams: { returnTo: typeof window !== "undefined" ? window.location.origin : undefined } });
                    }} className="w-full rounded px-3 py-2 text-left hover:bg-neutral-800">Log out</button>
                  </div>
                )}
              </>
            ) : (
              <button type="button" onClick={() => loginWithRedirect()} className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black">
                Log in
              </button>
            )}
            {hasSession && (
              <div className="mt-3 px-3 text-xs text-neutral-400">
                {planName} plan: {monthlyChatCount}/{usageLimit} chats this month
              </div>
            )}
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden />}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 shrink-0 border-b border-neutral-800 bg-neutral-950/95 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="rounded-md bg-neutral-800 px-3 py-2 text-sm md:hidden" onClick={() => setIsSidebarOpen((s) => !s)} aria-label="Toggle sidebar">Menu</button>
              <button className="hidden items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm md:inline-flex" onClick={() => setIsHistoryVisible((v) => !v)} aria-label="Toggle history visibility">
                Menu
              </button>
              <img src="/jupiter-black.svg" alt="Teller AI" className="h-8 w-8 object-contain" />
            </div>
            <div className="flex items-center gap-2">
              {hasSession && planName === "Free" && (
                <PayPalUpgradeButton
                  plan="pro-monthly"
                  className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-400"
                >
                  Upgrade
                </PayPalUpgradeButton>
              )}
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
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 modern-scroll">
          <div className="mx-auto min-w-0 max-w-3xl space-y-4">
            {messages.map((message, index) => (
              message.role === "user" && message.file ? null :
              <div key={index} className={`min-w-0 max-w-[85%] overflow-hidden rounded-xl p-4 [overflow-wrap:anywhere] ${message.role === "user" ? "ml-auto bg-blue-600" : "mr-auto bg-neutral-800"}`}>
                <div className="min-w-0 max-w-full text-sm leading-7 [overflow-wrap:anywhere]">
                  <FormattedMessage content={message.content} showCodeCopy={message.role === "assistant"} onCopyCode={(code) => void copyText(code, index)} />
                  {message.imageUrl && <img src={message.imageUrl} alt="Generated from your prompt" className="mt-4 max-h-[32rem] w-full rounded-lg object-contain" />}
                </div>
                <div className="mt-3 flex gap-2 border-t border-white/10 pt-2 opacity-70">
                  {message.role === "assistant" ? (
                    <>
                      <button type="button" onClick={() => void copyText(message.content, index)} className="rounded px-1 text-xl leading-none text-neutral-300 hover:text-white" aria-label={copiedMessage === index ? "Copied" : "Copy message"} title={copiedMessage === index ? "Copied" : "Copy message"}>{copiedMessage === index ? "✓" : "⧉"}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => editMessage(message, index)} className="rounded px-1 text-xl leading-none text-neutral-300 hover:text-white" aria-label="Edit message" title="Edit message">✎</button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="mr-auto max-w-[85%] rounded-xl bg-neutral-800 p-4 [overflow-wrap:anywhere]">Teller AI is thinking...</div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-neutral-800 p-4">
          <div className="mx-auto max-w-3xl">
            {hasSession ? (
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
              <div className="space-y-2">
                <button type="button" onClick={() => loginWithRedirect()} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800">
                  Log in to attach files and send messages
                </button>
              </div>
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
