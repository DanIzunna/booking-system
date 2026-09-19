"use client";

import Link from "next/link";
import { use, useState } from "react";
import { apiRequest } from "../../lib/api/client";
import { formatMoneyMinorUnits } from "../../lib/currency";

interface FakeCheckoutPageProps {
  searchParams: Promise<{
    providerReference?: string;
    amount?: string;
    currency?: string;
  }>;
}

type SimulationStatus = "SUCCEEDED" | "FAILED";

export default function FakeCheckoutPage({
  searchParams,
}: FakeCheckoutPageProps) {
  const params = use(searchParams);
  const providerReference = params.providerReference ?? "";
  const amount = Number(params.amount);
  const currency = params.currency ?? "";
  const reservationId = providerReference.startsWith("fake_reservation:")
    ? providerReference.slice("fake_reservation:".length)
    : "";
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SimulationStatus | null>(null);
  const [error, setError] = useState("");
  const validInput =
    Boolean(providerReference && currency) && Number.isFinite(amount);

  async function simulate(status: SimulationStatus) {
    if (!validInput || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      await apiRequest("/payments/webhooks/fake", {
        method: "POST",
        skipAuthRefresh: true,
        headers: { "x-fake-signature": "phase8-test-signature" },
        body: JSON.stringify({
          providerReference,
          status,
          amount,
          currency,
        }),
      });
      setResult(status);
    } catch {
      setError("The fake webhook could not be processed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (process.env.NODE_ENV === "production") {
    return <UnavailableState />;
  }

  if (!validInput) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
        <section className="w-full max-w-lg rounded-[8px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">
            Development simulator
          </p>
          <h1 className="mt-2 text-xl font-semibold">Invalid checkout link</h1>
          <p className="mt-2 text-sm leading-6">
            Open this page from a fake payment initialization response.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-[8px] border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          Development simulator
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Fake Payment Checkout
        </h1>
        <dl className="mt-6 grid gap-4 border-y border-slate-200 py-5 text-sm sm:grid-cols-2">
          <Detail label="Reservation" value={reservationId || "Unknown"} />
          <Detail label="Amount" value={formatMoneyMinorUnits(amount, currency)} />
          <Detail label="Currency" value={currency} />
          <Detail label="Provider reference" value={providerReference} />
        </dl>
        {result ? (
          <div className="mt-6 rounded-[6px] bg-slate-100 p-4 text-sm text-slate-700">
            <strong className="block text-slate-950">
              Payment {result === "SUCCEEDED" ? "successful" : "failed"}
            </strong>
            <span className="mt-1 block">
              The existing fake webhook handled this result.
            </span>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              className="min-h-11 rounded-[6px] bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              disabled={submitting}
              onClick={() => void simulate("SUCCEEDED")}
            >
              Simulate successful payment
            </button>
            <button
              className="min-h-11 rounded-[6px] border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              disabled={submitting}
              onClick={() => void simulate("FAILED")}
            >
              Simulate failed payment
            </button>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
        {reservationId && (
          <Link
            className="mt-6 inline-flex text-sm font-semibold text-slate-700 underline underline-offset-4"
            href={`/reservations/${encodeURIComponent(reservationId)}`}
          >
            Return to reservation
          </Link>
        )}
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-all font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function UnavailableState() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-[8px] border border-slate-300 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-950">
          Fake checkout unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The development payment simulator is disabled in production.
        </p>
      </section>
    </main>
  );
}