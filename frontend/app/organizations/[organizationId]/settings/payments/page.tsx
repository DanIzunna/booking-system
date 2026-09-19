"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserFacingError } from "../../../../../lib/api/client";
import {
  connectStripe,
  disconnectPaymentAccount,
  getPaymentAccount,
  syncPaymentAccount,
} from "../../../../../lib/api/payment-accounts";
import { listOrganizations } from "../../../../../lib/api/organizations";
import { useSession } from "../../../../../lib/auth/session-provider";
import { PageContainer } from "../../../../../components/layout/page-container";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import type { OrganizationPaymentAccount } from "../../../../../types/payment-accounts";

export default function OrganizationPaymentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [account, setAccount] = useState<OrganizationPaymentAccount | null>(
    null,
  );
  const [role, setRole] = useState<"OWNER" | "MEMBER" | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"connect" | "sync" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([
      getPaymentAccount(organizationId),
      listOrganizations(),
    ])
      .then(([nextAccount, organizations]) => {
        if (!cancelled) {
          setAccount(nextAccount);
          setRole(
            organizations.find(({ id }) => id === organizationId)?.role ??
              null,
          );
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            getUserFacingError(caught, "Unable to load payment settings."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, status]);

  async function handleConnect() {
    setAction("connect");
    setError("");
    try {
      const result = await connectStripe(organizationId);
      window.location.assign(result.onboardingUrl);
    } catch (caught) {
      setError(
        getUserFacingError(caught, "Unable to start Stripe onboarding."),
      );
      setAction(null);
    }
  }

  async function handleSync() {
    setAction("sync");
    setError("");
    try {
      const result = await syncPaymentAccount(organizationId);
      setAccount(result.account);
    } catch (caught) {
      setError(
        getUserFacingError(caught, "Unable to synchronize Stripe."),
      );
    } finally {
      setAction(null);
    }
  }

  async function handleDisconnect() {
    setAction("sync");
    setError("");
    try {
      const nextAccount = await disconnectPaymentAccount(organizationId);
      setAccount(nextAccount);
    } catch (caught) {
      setError(
        getUserFacingError(caught, "Unable to disconnect the payment account."),
      );
    } finally {
      setAction(null);
    }
  }

  if (status === "loading" || !user) {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  }

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href={`/organizations/${organizationId}`}
        >
          <ArrowLeft className="size-4" /> Back to workspace
        </Link>
        <header className="mt-8 border-b border-slate-200 pb-7">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Organization settings
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Payments
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Connect a payment provider to accept payments for paid Bookables.
          </p>
        </header>

        {error && (
          <p
            className="mt-6 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <section className="mt-8 max-w-2xl space-y-3">
            <Skeleton className="h-44 rounded-[8px]" />
          </section>
        ) : (
          <PaymentAccountCard
            account={account}
            canManage={role === "OWNER"}
            action={action}
            onConnect={() => void handleConnect()}
            onSync={() => void handleSync()}
            onDisconnect={() => void handleDisconnect()}
          />
        )}
      </main>
    </PageContainer>
  );
}

function PaymentAccountCard({
  account,
  canManage,
  action,
  onConnect,
  onSync,
  onDisconnect,
}: {
  account: OrganizationPaymentAccount | null;
  canManage: boolean;
  action: "connect" | "sync" | null;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  if (!account) {
    return (
      <Card className="mt-8 max-w-2xl">
        <CardContent>
          <h2 className="text-base font-semibold text-slate-950">
            Connect Stripe
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Connect Stripe to accept payments for paid Bookables.
          </p>
          {canManage ? (
            <Button className="mt-5" onClick={onConnect} disabled={action !== null}>
              {action === "connect" ? "Starting..." : "Connect Stripe"}
              <ExternalLink className="size-4" />
            </Button>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              Ask an organization owner to connect Stripe.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const ready = account.status === "READY" && account.readyForPayments;
  const label = statusLabel(account.status, ready);
  const variant = ready
    ? "success"
    : account.status === "RESTRICTED"
      ? "error"
      : "warning";

  return (
    <Card className="mt-8 max-w-2xl">
      <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Stripe
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {ready ? "Connected" : label}
            </h2>
          </div>
          <Badge variant={variant}>{label}</Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {ready
            ? "Your organization is ready to accept payments for paid Bookables."
            : account.status === "ONBOARDING"
              ? "Stripe setup is incomplete. Continue onboarding to accept payments."
              : account.status === "RESTRICTED"
                ? "Stripe requires additional setup or verification before payments can be accepted."
                : "This payment account is no longer ready. Reconnect Stripe to accept paid bookings."}
        </p>
        {!ready && canManage && (
          <Button className="mt-5" onClick={onConnect} disabled={action !== null}>
            {action === "connect" ? "Starting..." : "Continue Stripe setup"}
            <ExternalLink className="size-4" />
          </Button>
        )}
        {canManage && (
          <>
            <Button
              className="mt-5 sm:ml-2"
              variant="secondary"
              onClick={onSync}
              disabled={action !== null}
            >
              <RefreshCw className="size-4" />
              {action === "sync" ? "Syncing..." : "Sync status"}
            </Button>
            <Button
              className="mt-5 sm:ml-2"
              variant="danger"
              onClick={onDisconnect}
              disabled={action !== null}
            >
              Disconnect
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function statusLabel(
  status: OrganizationPaymentAccount["status"],
  ready: boolean,
): string {
  if (ready) return "Ready";
  if (status === "ONBOARDING") return "Onboarding incomplete";
  if (status === "RESTRICTED") return "Restricted";
  return "Disconnected";
}
