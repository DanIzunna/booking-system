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
      className="group flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 py-4 transition-colors hover:bg-slate-50"
      href={`/organizations/${organization.id}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-950">
            {organization.name}
          </h3>
          <Badge>{organization.role}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {organization.slug} · {organization.timezone}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-950" />
    </Link>
  );
}
