"use client";

import Link from "next/link";
import { use } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api/client";
import { getOrganization, listOrganizations } from "../../../lib/api/organizations";
import { useSession } from "../../../lib/auth/session-provider";
import type { Organization, MembershipRole } from "../../../types/organizations";
import { AppHeader } from "../../../components/layout/app-header";

interface OrganizationPageProps {
  params: Promise<{ organizationId: string }>;
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const loading = status === "authenticated" && loadedOrganizationId !== organizationId;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    void Promise.all([getOrganization(organizationId), listOrganizations()])
      .then(([nextOrganization, memberships]) => {
        if (cancelled) return;
        setOrganization(nextOrganization);
        setRole(memberships.find(({ id }) => id === organizationId)?.role ?? null);
        setLoadedOrganizationId(organizationId);
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
          setLoadedOrganizationId(organizationId);
        }
      })

    return () => {
      cancelled = true;
    };
  }, [organizationId, status]);

  if (status === "loading") return <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Checking your session...</main>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link className="text-sm font-semibold text-teal-700 hover:underline" href="/dashboard">← Back to organizations</Link>
        {loading && <p className="mt-10 text-sm text-slate-500">Loading organization...</p>}
        {!loading && errorStatus === 403 && (
          <section className="mt-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Access denied</p><h1 className="mt-3 text-3xl font-bold">You cannot access this organization.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your account does not have permission to view this workspace.</p>
          </section>
        )}
        {!loading && errorStatus === 404 && (
          <section className="mt-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Organization not found</p><h1 className="mt-3 text-3xl font-bold">This workspace is unavailable.</h1><p className="mt-3 text-sm leading-6 text-slate-500">The organization may not exist, or you may no longer belong to it.</p>
          </section>
        )}
        {!loading && errorStatus !== null && errorStatus !== 403 && errorStatus !== 404 && (
          <section className="mt-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Unable to load</p><h1 className="mt-3 text-3xl font-bold">We could not open this workspace.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Please try again shortly.</p>
          </section>
        )}
        {!loading && errorStatus === null && organization && (
          <section className="mt-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Organization workspace</p><div className="mt-3 flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-bold tracking-tight">{organization.name}</h1><p className="mt-2 text-sm text-slate-500">{organization.slug}</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-teal-800">{role ?? "Member"}</span></div><p className="mt-7 max-w-xl text-sm leading-6 text-slate-600">Manage the resources that can later be reserved in this organization.</p><Link className="mt-6 inline-flex items-center rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800" href={`/organizations/${organizationId}/bookables`}>Open bookables →</Link>
          </section>
        )}
      </main></div>
  );
}