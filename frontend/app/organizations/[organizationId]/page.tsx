"use client";

import Link from "next/link";
import { use } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api/client";
import { getOrganization, listOrganizations } from "../../../lib/api/organizations";
import { useSession } from "../../../lib/auth/session-provider";
import type { Organization, MembershipRole } from "../../../types/organizations";
import styles from "../../dashboard.module.css";

interface OrganizationPageProps {
  params: Promise<{ organizationId: string }>;
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user, logout } = useSession();
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

  if (status === "loading") return <main className={styles.page}><p className={styles.message}>Checking your session...</p></main>;
  if (!user) return null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.logo} href="/">Booking System</Link>
        <button className={styles.signOut} type="button" onClick={() => void logout()}>Sign out</button>
      </header>
      <section className={styles.content}>
        <Link className={styles.backLink} href="/dashboard">Back to organizations</Link>
        {loading && <p className={styles.message}>Loading organization...</p>}
        {!loading && errorStatus === 403 && (
          <section className={styles.state}>
            <p className={styles.eyebrow}>Access denied</p>
            <h1>You cannot access this organization.</h1>
            <p className={styles.message}>Your account does not have permission to view this workspace.</p>
          </section>
        )}
        {!loading && errorStatus === 404 && (
          <section className={styles.state}>
            <p className={styles.eyebrow}>Organization not found</p>
            <h1>This workspace is unavailable.</h1>
            <p className={styles.message}>The organization may not exist, or you may no longer belong to it.</p>
          </section>
        )}
        {!loading && errorStatus !== null && errorStatus !== 403 && errorStatus !== 404 && (
          <section className={styles.state}>
            <p className={styles.eyebrow}>Unable to load</p>
            <h1>We could not open this workspace.</h1>
            <p className={styles.message}>Please try again shortly.</p>
          </section>
        )}
        {!loading && errorStatus === null && organization && (
          <section className={styles.state}>
            <p className={styles.eyebrow}>Organization workspace</p>
            <h1>{organization.name}</h1>
            <p className={styles.slug}>{organization.slug}</p>
            <div className={styles.details}>
              <span>Your membership</span>
              <strong>{role ?? "Unavailable"}</strong>
            </div>
            <p className={styles.note}>Bookables and availability will appear here in a later phase.</p>
          </section>
        )}
      </section>
    </main>
  );
}