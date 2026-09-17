import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300">
          Introducing Teller AI
        </div>

        <img
          src="/jupiter-black.svg"
          alt="Black Jupiter illustration"
          className="mb-8 h-40 w-40"
        />

        <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
          Your intelligent AI assistant for work, research, and ideas.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-neutral-300">
          Teller AI helps you write, research, summarize, code, plan, and answer
          questions faster with a clean AI chat experience.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/chat"
            className="rounded-lg bg-white px-6 py-3 font-semibold text-black"
          >
            Start Chatting
          </Link>

          <Link
            href="/pricing"
            className="rounded-lg border border-neutral-700 px-6 py-3 font-semibold"
          >
            View Pricing
          </Link>

        </div>
      </section>
    </main>
  );
}
