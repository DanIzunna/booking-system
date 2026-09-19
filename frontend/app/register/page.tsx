"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { useSession } from "../../lib/auth/session-provider";
import { isInternalReturnTo } from "../../lib/public-booking/booking-selection";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, register } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const returnTo = isInternalReturnTo(searchParams.get("returnTo"))
    ? searchParams.get("returnTo")
    : null;

  useEffect(() => {
    if (status === "authenticated") router.replace(returnTo ?? "/dashboard");
  }, [returnTo, router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({ name, email, password });
      router.push(returnTo ?? "/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to create your account. Please try again.",
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
    <main className="flex min-h-screen flex-col bg-[#F4F4F5] px-4 sm:px-6">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-950"
        >
          <span className="grid size-7 place-items-center rounded-[6px] bg-indigo-500 text-xs font-bold text-white">
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
        <section className="w-full max-w-[440px] rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-7">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-indigo-500 text-sm font-bold text-white">
              B
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Create your account
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Create your workspace
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Set up resources your customers can book and manage them from one
              place.
            </p>
          </div>
          <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="min-h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="min-h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="min-h-11"
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
            <Button className="w-full min-h-11" type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <div className="mt-6 flex items-center gap-3 text-slate-300">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
              or
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              className="font-medium text-indigo-600 underline underline-offset-4 hover:text-indigo-700"
              href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"}
            >
              Sign in
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

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
          Checking your session...
        </main>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
