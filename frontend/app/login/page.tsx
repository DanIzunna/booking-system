"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { useSession } from "../../lib/auth/session-provider";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Link className={styles.back} href="/">Booking System</Link>
        <p className={styles.eyebrow}>Welcome back</p>
        <h1 className={styles.title}>Sign in.</h1>
        <p className={styles.subtitle}>Continue to your reservations and workspace.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field} htmlFor="email">
            Email
            <input className={styles.input} id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className={styles.field} htmlFor="password">
            Password
            <input className={styles.input} id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.button} type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className={styles.switch}>New here? <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  );
}
