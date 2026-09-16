"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { listOrganizations } from "../../lib/api/organizations";
import { useSession } from "../../lib/auth/session-provider";
import type { OrganizationSummary } from "../../types/organizations";
import { EmptyState } from "../../components/empty-state";
import { PageContainer } from "../../components/layout/page-container";
import { Button } from "../../components/ui/button";
import { WorkspaceRow } from "../../components/dashboard/workspace-row";
import { Skeleton } from "../../components/ui/skeleton";

export default function OrganizationsPage() {
  const router = useRouter();
  const { status, user } = useSession();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void listOrganizations()
      .then((items) => {
        if (!cancelled) setOrganizations(items);
      })
      .catch((caught) => {
        if (!cancelled)
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load your workspaces.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading")
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  if (!user) return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Workspaces
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Your workspaces
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Choose where you want to manage Bookable resources
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard")}>
            <Plus className="size-4" /> Create workspace
          </Button>
        </header>
        {error && (
          <p
            className="mt-6 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {!loaded ? (
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            <Skeleton className="h-20 rounded-none" />
            <Skeleton className="h-20 rounded-none" />
            <Skeleton className="h-20 rounded-none" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="mt-8 max-w-xl">
            <EmptyState
              title="No workspaces yet"
              description="Create a workspace to define resources, availability, and reservations."
              action={
                <Button onClick={() => router.push("/dashboard")}>
                  <Plus className="size-4" /> Create workspace
                </Button>
              }
            />
          </div>
        ) : (
          <section className="mt-8 max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-950">
                Accessible workspaces
              </h2>
              <span className="text-xs text-slate-500">
                {organizations.length} total
              </span>
            </div>
            {organizations.map((organization) => (
              <WorkspaceRow key={organization.id} organization={organization} />
            ))}
          </section>
        )}
      </main>
    </PageContainer>
  );
}
