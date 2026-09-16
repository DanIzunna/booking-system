"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { createOrganization, listOrganizations } from "../../lib/api/organizations";
import { useSession } from "../../lib/auth/session-provider";
import type { OrganizationSummary } from "../../types/organizations";
import { EmptyState } from "../../components/empty-state";
import { AppHeader } from "../../components/layout/app-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { formatTimeZoneName } from "../../lib/timezone";

const timezones = ["UTC", "Africa/Lagos", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];

export default function DashboardPage() {
  const router = useRouter();
  const { status, user } = useSession();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [router, status]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void listOrganizations().then((items) => { if (!cancelled) setOrganizations(items); }).catch((caught) => { if (!cancelled) setError(caught instanceof ApiError ? caught.message : "Unable to load your organizations."); }).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [status]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try { const organization = await createOrganization({ name: name.trim(), slug: slug.trim(), timezone }); router.push(`/organizations/${organization.id}`); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Unable to create this workspace."); }
    finally { setSubmitting(false); }
  }

  if (status === "loading") return <div className="min-h-screen bg-slate-50"><p className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-500">Checking your session...</p></div>;
  if (!user) return null;

  return <div className="min-h-screen bg-slate-50"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Dashboard</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Good to see you, {user.name}.</h1><p className="mt-2 text-sm text-slate-500">You are managing your organization&apos;s booking setup.</p></div>{organizations.length > 0 && <Button onClick={() => setCreating(!creating)}><Plus className="size-4" /> New workspace</Button>}</div>{error && <p className="mt-6 border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}{creating && <Card className="mt-8 max-w-2xl"><CardContent><div className="mb-6"><h2 className="text-lg font-semibold">Create a workspace</h2><p className="mt-1 text-sm text-slate-500">Create the home for your bookable services, spaces, events, or resources.</p></div><form className="grid gap-5 sm:grid-cols-2" onSubmit={handleCreate}><div className="space-y-2 sm:col-span-2"><Label htmlFor="organization-name">Workspace name</Label><Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required /></div><div className="space-y-2"><Label htmlFor="organization-slug">Workspace address</Label><Input id="organization-slug" value={slug} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="my-workspace" required /></div><div className="space-y-2"><Label htmlFor="organization-timezone">Local timezone</Label><select className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="organization-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>{timezones.map((item) => <option value={item} key={item}>{formatTimeZoneName(item)}</option>)}</select></div><div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create workspace"}</Button><Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button></div></form></CardContent></Card>}{!loaded ? <div className="mt-10 h-40 animate-pulse rounded-xl bg-slate-200" /> : organizations.length === 0 ? <div className="mt-10 max-w-2xl"><EmptyState title="Create your workspace" description="A workspace is where you create bookable services, spaces, events, or resources and manage their reservations." action={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> Create workspace</Button>} /></div> : <section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Your workspaces</h2><span className="text-sm text-slate-500">{organizations.length} total</span></div><div className="grid gap-4 md:grid-cols-2">{organizations.map((organization) => <Link href={`/organizations/${organization.id}`} key={organization.id}><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="flex h-full items-center justify-between gap-4"><div><p className="text-lg font-semibold">{organization.name}</p><p className="mt-1 text-sm text-slate-500">{organization.slug} · {organization.timezone}</p><span className="mt-4 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-800">{organization.role}</span></div><ArrowRight className="size-5 text-slate-400" /></CardContent></Card></Link>)}</div></section>}</main></div>;
}
