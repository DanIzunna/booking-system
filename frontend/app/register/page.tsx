"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { useSession } from "../../lib/auth/session-provider";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const { status, register } = useSession();
  const [name, setName] = useState("");
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
      await register({ name, email, password });
      router.push("/dashboard");
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
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[440px] flex-col justify-center">
        <Link
          href="/"
          className="mx-auto flex items-center gap-2 text-[13px] font-semibold text-slate-950"
        >
          <span className="grid size-7 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">
            B
          </span>{" "}
          Bookable
        </Link>
        <section className="mt-7 rounded-[8px] border border-slate-200 bg-white p-6 sm:p-8">
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Create your account
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Create your Bookable account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Start with an identity, then create or join a workspace
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
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              className="font-medium text-slate-950 underline underline-offset-4 hover:text-slate-600"
              href="/login"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
