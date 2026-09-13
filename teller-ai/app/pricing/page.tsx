import PayPalUpgradeButton from "@/components/PayPalUpgradeButton";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Pricing</h1>
          <p className="mt-4 text-neutral-300">
            Choose the Teller AI plan that works for you.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            name="Free"
            price="R0"
            features={["20 messages per day", "Basic AI chat", "Chat history"]}
            button="Start Free"
          />

          <PricingCard
            name="Pro"
            price="R180/mo"
            paypalPlan="pro-monthly"
            features={[
              "1,000 messages per month",
              "Faster responses",
              "Longer answers",
              "Priority access",
            ]}
            button="Upgrade to Pro"
            highlighted
          />

          <PricingCard
            name="Business"
            price="R520/mo"
            paypalPlan="business-monthly"
            features={[
              "5,000 messages per month",
              "Team access",
              "Priority support",
              "Advanced tools",
            ]}
            button="Upgrade to Business"
          />

          <PricingCard
            name="Pro (Yearly)"
            price="R1200/yr"
            paypalPlan="pro-yearly"
            features={[
              "1,000 messages per month",
              "Faster responses",
              "Longer answers",
              "Priority access",
            ]}
            button="Upgrade to Pro"
          />

          <PricingCard
            name="Business (Yearly)"
            price="R5800/yr"
            paypalPlan="business-yearly"
            features={[
              "5,000 messages per month",
              "Team access",
              "Priority support",
              "Advanced tools",
            ]}
            button="Upgrade to Business"
          />
        </div>
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  paypalPlan,
  features,
  button,
  highlighted,
}: {
  name: string;
  price: string;
  paypalPlan?: string;
  features: string[];
  button: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlighted
          ? "border-white bg-white text-black"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <h2 className="text-2xl font-bold">{name}</h2>
      <p className="mt-4 text-4xl font-bold">{price}</p>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>

      {paypalPlan ? (
        <PayPalUpgradeButton
          plan={paypalPlan}
          className={`mt-8 w-full rounded-lg px-4 py-3 font-semibold ${
            highlighted ? "bg-black text-white" : "bg-white text-black"
          }`}
        >
          {button}
        </PayPalUpgradeButton>
      ) : (
        <button
          className={`mt-8 w-full rounded-lg px-4 py-3 font-semibold ${
            highlighted ? "bg-black text-white" : "bg-white text-black"
          }`}
        >
          {button}
        </button>
      )}
    </div>
  );
}
