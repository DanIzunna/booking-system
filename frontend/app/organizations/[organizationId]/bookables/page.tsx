"use client";

import Link from "next/link";
import { use } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../lib/api/client";
import { listBookables } from "../../../../lib/api/bookables";
import { getOrganization } from "../../../../lib/api/organizations";
import { useSession } from "../../../../lib/auth/session-provider";
import type { Bookable } from "../../../../types/bookables";
import type { Organization } from "../../../../types/organizations";
import styles from "../../../dashboard.module.css";
import { PageContainer } from "../../../../components/layout/page-container";

interface BookablesPageProps {
  params: Promise<{ organizationId: string }>;
}

export default function BookablesPage({ params }: BookablesPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const loading = status === "authenticated" && !loaded;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    void Promise.all([
      getOrganization(organizationId),
      listBookables(organizationId),
    ])
      .then(([nextOrganization, nextBookables]) => {
        if (cancelled) return;
        setOrganization(nextOrganization);
        setBookables(nextBookables);
        setLoaded(true);
      })
      .catch((caught) => {
        if (cancelled) return;
        setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
        setLoaded(true);
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
          className={styles.backLink}
          href={`/organizations/${organizationId}`}
        >
          Back to organization
        </Link>
        {loading && <p className={styles.message}>Loading bookables...</p>}
        {!loading && errorStatus === 403 && (
          <ErrorState
            title="Access denied"
            message="You do not have permission to view these bookables."
          />
        )}
        {!loading && errorStatus === 404 && (
          <ErrorState
            title="Organization not found"
            message="This organization is unavailable or you no longer belong to it."
          />
        )}
        {!loading &&
          errorStatus !== null &&
          errorStatus !== 403 &&
          errorStatus !== 404 && (
            <ErrorState
              title="Unable to load bookables"
              message="Please try again shortly."
            />
          )}
        {!loading && errorStatus === null && organization && (
          <>
            <p className={styles.eyebrow}>Bookables</p>
            <div className={styles.pageHeading}>
              <div>
                <h1>{organization.name}</h1>
                <p className={styles.slug}>{organization.slug}</p>
              </div>
              <Link
                className={styles.primaryLink}
                href={`/organizations/${organizationId}/bookables/new`}
              >
                Create bookable
              </Link>
            </div>
            {bookables.length === 0 ? (
              <p className={styles.message}>
                No bookables belong to this organization yet.
              </p>
            ) : (
              <div className={styles.bookableList}>
                {bookables.map((bookable) => (
                  <Link
                    className={styles.bookable}
                    href={`/organizations/${organizationId}/bookables/${bookable.id}`}
                    key={bookable.id}
                  >
                    <span>
                      <strong>{bookable.name}</strong>
                      <small>{bookable.slug}</small>
                    </span>
                    <span className={styles.bookableMeta}>
                      <span>{bookable.status}</span>
                      <span>Capacity {bookable.capacity}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </PageContainer>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <section className={styles.state}>
      <p className={styles.eyebrow}>{title}</p>
      <h1>We could not open this area.</h1>
      <p className={styles.message}>{message}</p>
    </section>
  );
}
