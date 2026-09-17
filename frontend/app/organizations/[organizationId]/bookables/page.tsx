"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { use } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../lib/api/client";
import { listBookables } from "../../../../lib/api/bookables";
import { getOrganization } from "../../../../lib/api/organizations";
import { useSession } from "../../../../lib/auth/session-provider";
import type { Bookable } from "../../../../types/bookables";
import type { Organization } from "../../../../types/organizations";
import { EmptyState } from "../../../../components/empty-state";
import { PageContainer } from "../../../../components/layout/page-container";
import { BookableRow } from "../../../../components/bookables/bookable-row";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";

interface BookablesPageProps { params: Promise<{ organizationId: string }> }

export default function BookablesPage({ params }: BookablesPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [router, status]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([getOrganization(organizationId), listBookables(organizationId)])
      .then(([nextOrganization, nextBookables]) => { if (!cancelled) { setOrganization(nextOrganization); setBookables(nextBookables); setLoaded(true); } })
      .catch((caught) => { if (!cancelled) { setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [organizationId, status]);

  if (status === "loading") return <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Checking your session...</main>;
  if (!user) return null;

  return <PageContainer><main className="px-0 py-0"><Link className="inline-flex items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950" href={`/organizations/${organizationId}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>Back to workspace</Link>{!loaded && <section className="mt-8"><Skeleton className="h-8 w-48" /><Skeleton className="mt-3 h-5 w-72" /><div className="mt-10 space-y-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div></section>}{loaded && errorStatus !== null && <section className="mt-10 max-w-xl"><p className="text-xs font-medium uppercase tracking-[0.16em] text-red-700">{errorStatus === 403 ? "Access denied" : errorStatus === 404 ? "Workspace not found" : "Unable to load"}</p><h1 className="mt-3 text-2xl font-semibold">Couldn&apos;t load Bookables</h1><p className="mt-2 text-sm text-slate-500">Try again shortly</p></section>}{loaded && errorStatus === null && organization && <><header className="mt-8 flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{organization.name}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Bookables</h1><p className="mt-2 text-sm text-slate-500">Manage the resources customers can reserve</p></div><Button onClick={() => router.push(`/organizations/${organizationId}/bookables/new`)}><Plus className="size-4" /> Create Bookable</Button></header>{bookables.length === 0 ? <div className="mt-8 max-w-xl"><EmptyState title="No Bookables yet" description="Create a Bookable to give customers something they can reserve" action={<Button onClick={() => router.push(`/organizations/${organizationId}/bookables/new`)}><Plus className="size-4" /> Create Bookable</Button>} /></div> : <section className="mt-8"><div className="hidden grid-cols-[minmax(180px,1fr)_110px_120px_minmax(220px,1.2fr)_auto] gap-4 border-b border-slate-200 pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 lg:grid"><span>Name</span><span>Status</span><span>Capacity</span><span>Public booking</span><span>Action</span></div>{bookables.map((bookable) => <BookableRow key={bookable.id} organizationId={organizationId} bookable={bookable} />)}</section>}</>}</main></PageContainer>;
}
