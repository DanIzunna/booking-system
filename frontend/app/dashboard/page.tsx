"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import {
  createOrganization,
  listOrganizations,
} from "../../lib/api/organizations";
import { useSession } from "../../lib/auth/session-provider";
import type { OrganizationSummary } from "../../types/organizations";
import { EmptyState } from "../../components/empty-state";
import { PageContainer } from "../../components/layout/page-container";
import { WorkspaceRow } from "../../components/dashboard/workspace-row";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { formatTimeZoneName } from "../../lib/timezone";

const timezones = [
  "UTC",
  "Africa/Lagos",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
];

export default function DashboardPage() {
  const router = useRouter();
  const { status, user } = useSession();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const generatedSlug = slugify(name);
      const organization = await createOrganization({
        name: name.trim(),
        slug: generatedSlug,
        timezone,
      });
      router.push(`/organizations/${organization.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to create this workspace.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading")
    return (
      <div className="min-h-screen bg-slate-50">
        <p className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-500">
          Checking your session...
        </p>
      </div>
    );
  if (!user) return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Good to see you, {user.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Choose a workspace to continue managing Bookable resources
            </p>
          </div>
          {organizations.length > 0 && (
            <Button onClick={() => setCreating(!creating)}>
              <Plus className="size-4" /> New workspace
            </Button>
          )}
        </header>
        {error && (
          <p
            className="mt-6 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {creating && (
          <Card className="mt-8 max-w-2xl">
            <CardContent>
              <div className="mb-6">
                <h2 className="text-base font-semibold">Create a workspace</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create the home for your bookable services, spaces, events, or
                  resources
                </p>
              </div>
              <form
                className="grid gap-5 sm:grid-cols-2"
                onSubmit={handleCreate}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="organization-name">Workspace name</Label>
                  <Input
                    id="organization-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-timezone">Local timezone</Label>
                  <select
                    className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    id="organization-timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  >
                    {timezones.map((item) => (
                      <option value={item} key={item}>
                        {formatTimeZoneName(item)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create workspace"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {!loaded ? (
          <div className="mt-8 h-32 animate-pulse rounded-[8px] bg-slate-200" />
        ) : organizations.length === 0 ? (
          <div className="mt-8 max-w-xl">
            <EmptyState
              title="No workspaces yet"
              description="Create a workspace to define resources, availability, and reservations"
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> Create workspace
                </Button>
              }
            />
          </div>
        ) : (
          <section className="mt-8 max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-950">
                Your workspaces
              </h2>
              <Link
                className="text-xs font-medium text-slate-500 hover:text-slate-950"
                href="/organizations"
              >
                View all
              </Link>
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

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "workspace";
}
