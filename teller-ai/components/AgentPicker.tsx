import Link from "next/link";
import { ArrowRight, CalendarDays, Code2 } from "lucide-react";

const agents = [
  {
    id: "admin",
    name: "Admin",
    role: "Your personal admin assistant",
    description:
      "Plan your calendar, organize tasks, and draft or refine emails. Share the details here and Admin will help you get them in order.",
    note: "Email and calendar accounts are not connected.",
    icon: CalendarDays,
    accent: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  {
    id: "codex",
    name: "Codex",
    role: "Your coding project partner",
    description:
      "Turn an idea into a software project with help choosing a stack, planning the structure, writing code, and getting it running.",
    note: "Codex provides code and instructions in chat.",
    icon: Code2,
    accent: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  },
];

export default function AgentPicker() {
  return (
    <section
      aria-labelledby="agents-heading"
      className="min-h-0 flex-1 overflow-y-auto p-4 modern-scroll sm:p-8"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto mb-10 mt-6 max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">
            Teller AI
          </p>
          <h1 id="agents-heading" className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Choose your agent
          </h1>
          <p className="mt-4 text-neutral-400">
            Pick the assistant for the task. Each one opens in this chat window.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          {agents.map(({ id, name, role, description, note, icon: Icon, accent }) => (
            <article
              key={id}
              className="flex min-h-80 flex-col rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 sm:p-8"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${accent}`}>
                <Icon size={23} aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold">{name}</h2>
              <p className="mt-1 text-sm font-medium text-neutral-300">{role}</p>
              <p className="mt-4 flex-1 leading-7 text-neutral-400">{description}</p>
              <p className="mt-4 text-xs text-neutral-500">{note}</p>
              <Link
                href={`/chat/${id}`}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200"
              >
                Open {name} chat
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
