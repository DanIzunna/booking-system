import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "../ui/badge";
import type { OrganizationSummary } from "../../types/organizations";

export function WorkspaceRow({
  organization,
}: {
  organization: OrganizationSummary;
}) {
  return (
    <Link
      className="group flex min-h-44 flex-col justify-between rounded-[12px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      href={`/organizations/${organization.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-indigo-50 text-sm font-semibold text-indigo-700">
            {organization.name.trim().charAt(0).toUpperCase() || "W"}
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold tracking-tight text-slate-950">
              {organization.name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {organization.timezone}
            </p>
          </div>
        </div>
        <Badge>{organization.role}</Badge>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 transition-colors group-hover:text-slate-950">
        <span>Open workspace</span>
        <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
