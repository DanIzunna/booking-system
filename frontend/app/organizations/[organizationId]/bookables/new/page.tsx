"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookableWizard } from "../../../../../components/bookables/wizard/bookable-wizard";
import { PageContainer } from "../../../../../components/layout/page-container";
import { useSession } from "../../../../../lib/auth/session-provider";

interface NewBookablePageProps {
  params: Promise<{ organizationId: string }>;
}

export default function NewBookablePage({ params }: NewBookablePageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status } = useSession();

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

  if (status === "unauthenticated") return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <section className="max-w-3xl">
          <Link
            className="mb-8 flex min-h-11 w-fit items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            href={`/organizations/${organizationId}/bookables`}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to bookables
          </Link>

          <BookableWizard organizationId={organizationId} />
        </section>
      </main>
    </PageContainer>
  );
}
