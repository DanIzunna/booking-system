"use client";

import Link from "next/link";
import { use } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api/client";
import {
  getOrganization,
  listOrganizations,
} from "../../../lib/api/organizations";
import { listBookables } from "../../../lib/api/bookables";
import { useSession } from "../../../lib/auth/session-provider";
import type {
  Organization,
  MembershipRole,
} from "../../../types/organizations";
import type { Bookable } from "../../../types/bookables";
import { PageContainer } from "../../../components/layout/page-container";
import { BookableOverview } from "../../../components/dashboard/bookable-overview";
import { EmptyState } from "../../../components/empty-state";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";

interface OrganizationPageProps {
  params: Promise<{ organizationId: string }>;
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<
    string | null
  >(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [bookablesLoaded, setBookablesLoaded] = useState(false);
  const loading =
    status === "authenticated" && loadedOrganizationId !== organizationId;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    void Promise.all([
      getOrganization(organizationId),
      listOrganizations(),
      listBookables(organizationId),
    ])
      .then(([nextOrganization, memberships, nextBookables]) => {
        if (cancelled) return;
        setOrganization(nextOrganization);
        setRole(
          memberships.find(({ id }) => id === organizationId)?.role ?? null,
        );
        setBookables(nextBookables);
        setLoadedOrganizationId(organizationId);
        setBookablesLoaded(true);
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
          setLoadedOrganizationId(organizationId);
          setBookablesLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, status]);

  if (status === "loading")
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  if (!user) return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <Link
          className="text-sm font-semibold text-teal-700 hover:underline"
          href="/dashboard"
        >
          ← Back to organizations
        </Link>
        {loading && (
          <p className="mt-10 text-sm text-slate-500">
            Loading organization...
          </p>
        )}
        {!loading && errorStatus === 403 && (
          <section className="mt-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
              Access denied
            </p>
            <h1 className="mt-3 text-3xl font-bold">
              You cannot access this organization.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your account does not have permission to view this workspace.
            </p>
          </section>
        )}
        {!loading && errorStatus === 404 && (
          <section className="mt-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
              Organization not found
            </p>
            <h1 className="mt-3 text-3xl font-bold">
              This workspace is unavailable.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              The organization may not exist, or you may no longer belong to it.
            </p>
          </section>
        )}
        {!loading &&
          errorStatus !== null &&
          errorStatus !== 403 &&
          errorStatus !== 404 && (
            <section className="mt-10 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
                Unable to load
              </p>
              <h1 className="mt-3 text-3xl font-bold">
                We could not open this workspace.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Please try again shortly.
              </p>
            </section>
          )}
        {!loading && errorStatus === null && organization && (
          <section className="mt-8">
            <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Workspace overview
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {organization.name}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {organization.slug} · {organization.timezone}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-[4px] border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {role ?? "MEMBER"}
                </span>
                <Button
                  onClick={() =>
                    router.push(
                      `/organizations/${organizationId}/bookables/new`,
                    )
                  }
                >
                  Create Bookable
                </Button>
              </div>
            </div>
            <div className="mt-8 max-w-3xl">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Bookables
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Resources customers can reserve in this workspace
                  </p>
                </div>
                <Link
                  className="text-sm font-medium text-slate-700 hover:text-slate-950"
                  href={`/organizations/${organizationId}/bookables`}
                >
                  View all
                </Link>
              </div>
              {!bookablesLoaded ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  <Skeleton className="h-20 rounded-none" />
                  <Skeleton className="h-20 rounded-none" />
                </div>
              ) : bookables.length === 0 ? (
                <EmptyState
                  title="No Bookables yet"
                  description="Create your first Bookable to start accepting reservations"
                  action={
                    <Button
                      onClick={() =>
                        router.push(
                          `/organizations/${organizationId}/bookables/new`,
                        )
                      }
                    >
                      Create Bookable
                    </Button>
                  }
                />
              ) : (
                <BookableOverview
                  organizationId={organizationId}
                  bookables={bookables.slice(0, 5)}
                />
              )}
            </div>
          </section>
        )}
      </main>
    </PageContainer>
  );
}
