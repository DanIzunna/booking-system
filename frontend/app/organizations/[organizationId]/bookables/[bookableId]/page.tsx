"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../lib/api/client";
import { archiveBookable, getBookable, updateBookable } from "../../../../../lib/api/bookables";
import { listOrganizations } from "../../../../../lib/api/organizations";
import { useSession } from "../../../../../lib/auth/session-provider";
import type { Bookable, BookableStatus } from "../../../../../types/bookables";
import type { MembershipRole } from "../../../../../types/organizations";
import styles from "../../../../dashboard.module.css";
import { AppHeader } from "../../../../../components/layout/app-header";

interface BookablePageProps {
  params: Promise<{ organizationId: string; bookableId: string }>;
}

export default function BookablePage({ params }: BookablePageProps) {
  const { organizationId, bookableId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [bookable, setBookable] = useState<Bookable | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [capacity, setCapacity] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const loading = status === "authenticated" && !loaded;
  const canManage = role === "OWNER";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([getBookable(bookableId), listOrganizations()])
      .then(([nextBookable, organizations]) => {
        if (cancelled) return;
        if (nextBookable.organizationId !== organizationId) {
          setErrorStatus(404);
          setLoaded(true);
          return;
        }
        setBookable(nextBookable);
        setRole(organizations.find(({ id }) => id === organizationId)?.role ?? null);
        setName(nextBookable.name);
        setDescription(nextBookable.description ?? "");
        setSlug(nextBookable.slug);
        setCapacity(String(nextBookable.capacity));
        setLoaded(true);
      })
      .catch((caught) => {
        if (cancelled) return;
        setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [bookableId, organizationId, status]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError("");
    setPendingAction("update");
    try {
      const updated = await updateBookable(bookableId, { name: name.trim(), description: description.trim() || undefined, slug: slug.trim(), capacity: Number(capacity) });
      setBookable(updated);
      setEditing(false);
    } catch (caught) {
      setMutationError(caught instanceof ApiError ? formatMutationError(caught) : "Unable to update this bookable.");
    } finally { setPendingAction(""); }
  }

  async function handleStatus(statusValue: BookableStatus) {
    if (!bookable) return;
    const label = statusValue === "PUBLISHED" ? "publish" : "archive";
    if (statusValue === "ARCHIVED" && !window.confirm("Archive this bookable? It will no longer be active.")) return;
    setMutationError("");
    setPendingAction(label);
    try {
      const updated = statusValue === "ARCHIVED" ? await archiveBookable(bookableId) : await updateBookable(bookableId, { status: statusValue });
      setBookable(updated);
      if (statusValue === "PUBLISHED") {
        router.push(`/organizations/${organizationId}/bookables`);
        return;
      }
    } catch (caught) {
      setMutationError(caught instanceof ApiError ? formatMutationError(caught) : `Unable to ${label} this bookable.`);
    } finally { setPendingAction(""); }
  }

  if (status === "loading") return <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Checking your session...</main>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link className={styles.backLink} href={`/organizations/${organizationId}/bookables`}>Back to bookables</Link>
        {loading && <p className={styles.message}>Loading bookable...</p>}
        {!loading && errorStatus === 403 && <ErrorState title="Access denied" message="You do not have permission to view this bookable." />}
        {!loading && errorStatus === 404 && <ErrorState title="Bookable not found" message="This resource is unavailable or does not belong to this organization." />}
        {!loading && errorStatus !== null && errorStatus !== 403 && errorStatus !== 404 && <ErrorState title="Unable to load bookable" message="Please try again shortly." />}
        {!loading && errorStatus === null && bookable && (
          <>
            <p className={styles.eyebrow}>Bookable</p>
            <div className={styles.pageHeading}><div><h1>{bookable.name}</h1><p className={styles.slug}>{bookable.slug}</p></div><span className={styles.statusLabel}>{bookable.status}</span></div>
            <div className={styles.details}><span>Capacity</span><strong>{bookable.capacity}</strong></div>
            <p className={styles.description}>{bookable.description || "No description provided."}</p>
            <Link className={styles.actionLink} href={`/organizations/${organizationId}/bookables/${bookableId}/availability`}>Configure availability</Link>
            {mutationError && <p className={styles.error} role="alert">{mutationError}</p>}
            {canManage && !editing && <div className={styles.actionRow}><button className={styles.primaryButton} type="button" onClick={() => setEditing(true)}>Edit bookable</button>{bookable.status === "DRAFT" && <button className={styles.secondaryButton} type="button" disabled={Boolean(pendingAction)} onClick={() => void handleStatus("PUBLISHED")}>{pendingAction === "publish" ? "Publishing..." : "Publish"}</button>}{bookable.status !== "ARCHIVED" && <button className={styles.dangerButton} type="button" disabled={Boolean(pendingAction)} onClick={() => void handleStatus("ARCHIVED")}>{pendingAction === "archive" ? "Archiving..." : "Archive"}</button>}</div>}
            {editing && canManage && <form className={styles.bookableForm} onSubmit={handleUpdate}><label className={styles.formField}>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className={styles.formField}>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label className={styles.formField}>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label><label className={styles.formField}>Capacity<input type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} required /></label><div className={styles.actionRow}><button className={styles.primaryButton} type="submit" disabled={Boolean(pendingAction)}>{pendingAction === "update" ? "Saving..." : "Save changes"}</button><button className={styles.secondaryButton} type="button" onClick={() => setEditing(false)}>Cancel</button></div></form>}
            {!canManage && <p className={styles.note}>Only organization owners can edit, publish, or archive bookables.</p>}
          </>
        )}
      </main></div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return <section className={styles.state}><p className={styles.eyebrow}>{title}</p><h1>We could not open this bookable.</h1><p className={styles.message}>{message}</p></section>;
}

function formatMutationError(error: ApiError): string {
  if (error.statusCode === 403) return "Only an organization owner can change this bookable.";
  if (error.statusCode === 404) return "This bookable is no longer available.";
  if (error.statusCode === 409) return "That slug is already in use. Choose another one.";
  if (error.statusCode === 400) return error.message || "Check the bookable details and try again.";
  return "Unable to save this change. Please try again.";
}