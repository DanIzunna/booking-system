"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { useSession } from "../../lib/auth/session-provider";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({ name, email, password });
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Link className={styles.back} href="/">Booking System</Link>
        <p className={styles.eyebrow}>Start booking clearly</p>
        <h1 className={styles.title}>Create an account.</h1>
        <p className={styles.subtitle}>One account for the places and reservations that matter to you.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field} htmlFor="name">
            Name
            <input className={styles.input} id="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className={styles.field} htmlFor="email">
            Email
            <input className={styles.input} id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className={styles.field} htmlFor="password">
            Password
            <input className={styles.input} id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.button} type="submit" disabled={submitting}>{submitting ? "Creating account..." : "Create account"}</button>
        </form>
        <p className={styles.switch}>Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
