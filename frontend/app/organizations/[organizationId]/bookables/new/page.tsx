"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../lib/api/client";
import { createBookable } from "../../../../../lib/api/bookables";
import { useSession } from "../../../../../lib/auth/session-provider";
import styles from "../../../../dashboard.module.css";

interface NewBookablePageProps {
  params: Promise<{ organizationId: string }>;
}

export default function NewBookablePage({ params }: NewBookablePageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  if (status === "loading") return <main className={styles.page}><p className={styles.message}>Checking your session...</p></main>;
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
        slug: slug.trim(),
        capacity: Number(capacity),
      });
      router.push(`/organizations/${organizationId}/bookables/${bookable.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? formatBookableError(caught) : "Unable to create this bookable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.formPage}>
        <Link className={styles.backLink} href={`/organizations/${organizationId}/bookables`}>Back to bookables</Link>
        <p className={styles.eyebrow}>New bookable</p>
        <h1>Create a resource.</h1>
        <p className={styles.message}>New bookables begin as drafts. You can publish them from their detail page.</p>
        <form className={styles.bookableForm} onSubmit={handleSubmit}>
          <label className={styles.formField}>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required /></label>
          <label className={styles.formField}>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="main-conference-room" maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><small>Lowercase letters, numbers, and hyphens.</small></label>
          <label className={styles.formField}>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label>
          <label className={styles.formField}>Capacity<input type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} required /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primaryButton} type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create bookable"}</button>
        </form>
      </section>
    </main>
  );
}

function formatBookableError(error: ApiError): string {
  if (error.statusCode === 403) return "You do not have permission to create a bookable here.";
  if (error.statusCode === 404) return "This organization is unavailable.";
  if (error.statusCode === 409) return "That slug is already in use. Choose another one.";
  if (error.statusCode === 400) return error.message || "Check the bookable details and try again.";
  return "Unable to create this bookable. Please try again.";
}