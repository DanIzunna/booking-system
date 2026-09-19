"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../../lib/auth/session-provider";
import { CustomerContainer } from "../../components/layout/customer-shell";
import { Card, CardContent } from "../../components/ui/card";

export default function AccountPage() {
  const router = useRouter();
  const { status, user } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  }

  if (!user) return null;

  return (
    <CustomerContainer>
      <main className="px-0 py-0">
        <header className="border-b border-slate-200 pb-7">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Customer account
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Account
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your Bookable account information.
          </p>
        </header>

        <section className="mt-8 max-w-2xl">
          <Card>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Name
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-slate-950">
                    {user.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Email
                  </dt>
                  <dd className="mt-2 break-words text-sm font-medium text-slate-950">
                    {user.email}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              href="/reservations"
            >
              View reservations <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    </CustomerContainer>
  );
}
