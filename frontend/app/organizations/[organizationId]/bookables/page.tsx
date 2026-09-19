"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { use } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../lib/api/client";
import { listBookables } from "../../../../lib/api/bookables";
import { getOrganization } from "../../../../lib/api/organizations";
import { useSession } from "../../../../lib/auth/session-provider";
import type { Bookable } from "../../../../types/bookables";
import type { Organization } from "../../../../types/organizations";
import { EmptyState } from "../../../../components/empty-state";
import { PageContainer } from "../../../../components/layout/page-container";
import { BookableRow } from "../../../../components/bookables/bookable-row";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";

interface BookablesPageProps {
  params: Promise<{ organizationId: string }>;
}

const PAGE_SIZE = 10;
const statusOptions = ["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const;
type BookableFilterStatus = (typeof statusOptions)[number];

export default function BookablesPage({ params }: BookablesPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookableFilterStatus>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([
      getOrganization(organizationId),
      listBookables(organizationId),
    ])
      .then(([nextOrganization, nextBookables]) => {
        if (!cancelled) {
          setOrganization(nextOrganization);
          setBookables(nextBookables);
          setLoaded(true);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, status]);

  const filteredBookables = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bookables.filter((bookable) => {
      const matchesStatus =
        statusFilter === "ALL" || bookable.status === statusFilter;
      const searchText =
        `${bookable.name} ${bookable.description ?? ""}`.toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 || searchText.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [bookables, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBookables.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedBookables = filteredBookables.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
  };

  if (status === "loading")
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  if (!user) return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <Link
          className="inline-flex items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          href={`/organizations/${organizationId}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to workspace</span>
        </Link>
        {!loaded && (
          <section className="mt-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-3 h-5 w-72" />
            <div className="mt-10 space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </section>
        )}
        {loaded && errorStatus !== null && (
          <section className="mt-10 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-700">
              {errorStatus === 403
                ? "Access denied"
                : errorStatus === 404
                  ? "Workspace not found"
                  : "Unable to load"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold">
              Couldn&apos;t load Bookables
            </h1>
            <p className="mt-2 text-sm text-slate-500">Try again shortly</p>
          </section>
        )}
        {loaded && errorStatus === null && organization && (
          <>
            <header className="mt-8 flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {organization.name}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Bookables
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Manage the resources customers can reserve
                </p>
              </div>
              <Button
                onClick={() =>
                  router.push(`/organizations/${organizationId}/bookables/new`)
                }
              >
                <Plus className="size-4" /> Create Bookable
              </Button>
            </header>

            {bookables.length === 0 ? (
              <div className="mt-8 max-w-xl">
                <EmptyState
                  title="No Bookables yet"
                  description="Create your first Bookable to start accepting reservations."
                  action={
                    <Button
                      onClick={() =>
                        router.push(
                          `/organizations/${organizationId}/bookables/new`,
                        )
                      }
                    >
                      <Plus className="size-4" /> Create Bookable
                    </Button>
                  }
                />
              </div>
            ) : (
              <section className="mt-8 space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                  <label className="relative block flex-1">
                    <span className="sr-only">Search bookables</span>
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-500"
                      placeholder="Search bookables..."
                      aria-label="Search bookables"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="hidden sm:inline">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => {
                        setStatusFilter(
                          event.target.value as BookableFilterStatus,
                        );
                        setPage(1);
                      }}
                      className="min-h-10 rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                      aria-label="Filter bookables by status"
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === "ALL"
                            ? "All"
                            : option === "PUBLISHED"
                              ? "Published"
                              : option === "DRAFT"
                                ? "Draft"
                                : "Archived"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {filteredBookables.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <h2 className="text-lg font-semibold text-slate-950">
                      No Bookables match your filters.
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Clear the filters and try again.
                    </p>
                    <div className="mt-5 flex justify-center">
                      <Button variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Showing{" "}
                        {filteredBookables.length === 0 ? 0 : startIndex + 1}-
                        {Math.min(
                          startIndex + PAGE_SIZE,
                          filteredBookables.length,
                        )}{" "}
                        of {filteredBookables.length}
                      </span>
                      <span>
                        {statusFilter === "ALL" ? "All statuses" : statusFilter}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 md:grid md:grid-cols-[minmax(0,2.4fr)_170px_150px_140px_180px]">
                        <span>Name</span>
                        <span>Status</span>
                        <span>Capacity</span>
                        <span>Price</span>
                        <span className="text-right">Actions</span>
                      </div>
                      {paginatedBookables.map((bookable) => (
                        <BookableRow
                          key={bookable.id}
                          organizationId={organizationId}
                          organizationSlug={organization.slug}
                          bookable={bookable}
                        />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setPage((current) => Math.max(1, current - 1))
                          }
                          disabled={safePage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          {Array.from(
                            { length: totalPages },
                            (_, index) => index + 1,
                          ).map((pageNumber) => (
                            <button
                              key={pageNumber}
                              type="button"
                              onClick={() => setPage(pageNumber)}
                              className={[
                                "grid h-8 min-w-8 place-items-center rounded-[6px] border text-xs font-medium",
                                pageNumber === safePage
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                              ].join(" ")}
                              aria-label={`Go to page ${pageNumber}`}
                            >
                              {pageNumber}
                            </button>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setPage((current) =>
                              Math.min(totalPages, current + 1),
                            )
                          }
                          disabled={safePage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </PageContainer>
  );
}
