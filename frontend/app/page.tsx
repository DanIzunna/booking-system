import Link from "next/link";
import { ArrowRight, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { ProductPreview } from "../components/landing/product-preview";
import { PublicHeader } from "../components/layout/public-header";
import { SiteFooter } from "../components/layout/site-footer";

const steps = [
  ["01", "Create a Bookable", "Define the thing people can reserve"],
  [
    "02",
    "Configure availability",
    "Set schedules, capacity, and booking rules",
  ],
  [
    "03",
    "Share the booking link",
    "Customers open the public page and make a reservation",
  ],
];

const examples = [
  "Appointments",
  "Consultation sessions",
  "Meeting rooms",
  "Classes",
  "Workshops",
  "Events",
  "Equipment",
  "Other reservable resources",
];
const capabilities = [
  ["Availability", "Define recurring schedules and specific availability"],
  ["Capacity", "Control how many reservation units can be accepted"],
  ["Public booking", "Give each published Bookable a shareable public URL"],
  ["Reservations", "Track customers, times, quantities, and status"],
  ["Payments", "Support paid Bookables through the payment architecture"],
  [
    "Multi-tenant workspaces",
    "Keep each organization’s resources and reservations distinct",
  ],
];

export default function Home() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <PublicHeader />
      <section className="border-b border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Booking infrastructure
          </p>
          <h1 className="mt-5 text-[42px] font-bold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Create a bookable resource
            <br className="hidden sm:block" /> Share the link. Take reservations
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600">
            Define what can be booked, set when it is available, and give
            customers a simple link to make reservations.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-indigo-500 px-5 text-[13px] font-medium text-white hover:bg-indigo-600"
              href="/register"
            >
              Get started <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-5 text-[13px] font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
              href="#how-it-works"
            >
              See how it works{" "}
              <ChevronRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-4xl">
          <ProductPreview />
        </div>
      </section>
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="grid gap-10 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              How it works
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              A clear path from resource to reservation
            </h2>
          </div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {steps.map(([number, title, description]) => (
              <div
                className="grid gap-3 py-5 sm:grid-cols-[48px_0.8fr_1.2fr] sm:items-center"
                key={number}
              >
                <span className="text-xs font-medium tabular-nums text-slate-400">
                  {number}
                </span>
                <h3 className="text-sm font-semibold text-slate-950">
                  {title}
                </h3>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        id="organizations"
        className="border-y border-slate-200 bg-white"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.7fr_1.3fr] lg:px-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Flexible infrastructure
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              The system behind a useful booking link
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Bookable gives organizations a focused place to define resources
              and the conditions under which they can be reserved.
            </p>
          </div>
          <div className="grid divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {capabilities.map(([title, description], index) => (
              <div
                className={`py-5 sm:px-5 ${index >= 2 ? "sm:border-t sm:border-slate-200" : ""}`}
                key={title}
              >
                <h3 className="text-sm font-semibold text-slate-950">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        id="customers"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="grid gap-10 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              What can be booked
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              One model for many kinds of resources
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Bookable is infrastructure, not a marketplace. Organizations
              decide what they offer and how customers reach it.
            </p>
          </div>
          <div className="grid grid-cols-2 border-l border-t border-slate-200 sm:grid-cols-4">
            {examples.map((example) => (
              <div
                className="border-b border-r border-slate-200 px-4 py-5 text-sm font-medium text-slate-800"
                key={example}
              >
                {example}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Public booking
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Create once. Share anywhere.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Every published Bookable can have a simple public link customers
              can open directly.
            </p>
            <div className="mt-5 flex max-w-xl items-center gap-3 rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-3">
              <code className="min-w-0 flex-1 truncate text-xs text-slate-700">
                bookable.app/book/demo-workspace/consultation-session
              </code>
              <button className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Copy className="size-3.5" aria-hidden="true" /> Copy link
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-indigo-500 px-4 text-[13px] font-medium text-white hover:bg-indigo-600"
              href="/register"
            >
              Create a Bookable{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-300 px-4 text-[13px] font-medium text-slate-700">
              <ExternalLink className="size-4" aria-hidden="true" /> Open
              booking page
            </span>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border-y border-slate-200 py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Ready to make something bookable?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Start with a workspace and create your first resource
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-indigo-500 px-5 text-[13px] font-medium text-white hover:bg-indigo-600"
            href="/register"
          >
            Create your first Bookable{" "}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
