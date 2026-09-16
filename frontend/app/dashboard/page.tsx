"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../../lib/auth/session-provider";
import styles from "../dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const { status, user, logout } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

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
        <p className={styles.note}>Your booking workspace will appear here as the next parts of the platform come online.</p>
      </section>
    </main>
  );
}
