"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../lib/api/client";
import { createBookable } from "../../../../../lib/api/bookables";
import { useSession } from "../../../../../lib/auth/session-provider";
import { AppHeader } from "../../../../../components/layout/app-header";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";

interface NewBookablePageProps {
  params: Promise<{ organizationId: string }>;
}

export default function NewBookablePage({ params }: NewBookablePageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  if (status === "loading") return <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Checking your session...</main>;
  if (status === "unauthenticated") return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const bookable = await createBookable({
        organizationId,
        name: name.trim(),
        description: description.trim() || undefined,
        capacity: Number(capacity),
      });
      router.push(`/organizations/${organizationId}/bookables/${bookable.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? formatBookableError(caught) : "Unable to create this bookable.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="min-h-screen bg-slate-50"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><section className="max-w-3xl"><Link className="text-sm font-semibold text-teal-700 hover:underline" href={`/organizations/${organizationId}/bookables`}>← Back to bookables</Link><div className="mt-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">New bookable</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Create a resource</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Start with the resource people will reserve. It will be created as a draft until you publish it.</p></div><Card className="mt-8"><CardContent><form className="grid gap-6" onSubmit={handleSubmit}><div className="space-y-2"><Label htmlFor="bookable-name">Name</Label><Input id="bookable-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="Main consultation room" required /><p className="text-xs text-slate-500">Use the name customers should recognize.</p></div><div className="space-y-2"><Label htmlFor="bookable-description">Description</Label><textarea className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="bookable-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short description of what this resource is for." rows={4} /></div><div className="space-y-2"><Label htmlFor="bookable-capacity">Capacity</Label><Input id="bookable-capacity" type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} required /><p className="text-xs text-slate-500">How many people or units can be reserved at once.</p></div>{error && <p className="border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}<div><Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create bookable"}</Button></div></form></CardContent></Card></section></main></div>;
}

function formatBookableError(error: ApiError): string {
  if (error.statusCode === 403) return "You do not have permission to create a bookable here.";
  if (error.statusCode === 404) return "This organization is unavailable.";
  if (error.statusCode === 409) return "That slug is already in use. Choose another one.";
  if (error.statusCode === 400) return error.message || "Check the bookable details and try again.";
  return "Unable to create this bookable. Please try again.";
}