"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api/client";
import { listOrganizations } from "../../lib/api/organizations";
import { useSession } from "../../lib/auth/session-provider";
import type { OrganizationSummary } from "../../types/organizations";
import styles from "../dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const { status, user, logout } = useSession();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const loadingOrganizations = status === "authenticated" && !organizationsLoaded;
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    void listOrganizations()
      .then((nextOrganizations) => {
        if (!cancelled) setOrganizations(nextOrganizations);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Unable to load your organizations.");
        }
      })
      .finally(() => {
        if (!cancelled) setOrganizationsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") return <main className={styles.page}><p>Checking your session...</p></main>;
  if (!user) return null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.logo} href="/">Booking System</Link>
        <button className={styles.signOut} type="button" onClick={() => void logout()}>Sign out</button>
      </header>
      <section className={styles.content}>
        <p className={styles.eyebrow}>Your workspace</p>
        <h1>Welcome, {user.name}.</h1>
        <p className={styles.email}>{user.email}</p>
        <div className={styles.status}>Signed in as <strong>{user.platformRole}</strong></div>
        <div className={styles.organizations}>
          <div>
            <p className={styles.sectionLabel}>Organizations</p>
            <h2>Choose a workspace</h2>
          </div>
          {loadingOrganizations && <p className={styles.message}>Loading your organizations...</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!loadingOrganizations && !error && organizations.length === 0 && (
            <p className={styles.message}>You do not belong to any organizations yet.</p>
          )}
          {!loadingOrganizations && !error && organizations.length > 0 && (
            <div className={styles.organizationList}>
              {organizations.map((organization) => (
                <Link className={styles.organization} href={`/organizations/${organization.id}`} key={organization.id}>
                  <span>
                    <strong>{organization.name}</strong>
                    <small>{organization.slug}</small>
                  </span>
                  <span className={styles.role}>{organization.role}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
