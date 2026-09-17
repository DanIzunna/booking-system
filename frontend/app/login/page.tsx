"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { useSession } from "../../lib/auth/session-provider";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { status, login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || status === "authenticated")
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Checking your session...
      </main>
    );

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-4 sm:px-6">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-950"
        >
          <span className="grid size-7 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">
            B
          </span>
          Bookable
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Bookable
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center py-10 sm:py-14">
        <section className="w-full max-w-[440px] px-1 py-6 sm:px-0">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Welcome back
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Sign in to Bookable
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Manage your bookables, schedules, and reservations.
            </p>
          </div>
          <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <p
                className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              className="font-medium text-slate-950 underline underline-offset-4 hover:text-slate-600"
              href="/register"
            >
              Create one
            </Link>
          </p>
        </section>
      </div>
      <footer className="mx-auto flex w-full max-w-6xl justify-center py-6 text-xs text-slate-400">
        © 2026 Bookable
      </footer>
    </main>
  );
}
