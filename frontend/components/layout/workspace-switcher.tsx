"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listOrganizations } from "../../lib/api/organizations";
import type { OrganizationSummary } from "../../types/organizations";

interface WorkspaceSwitcherProps {
  organizationId?: string;
  onNavigate?: () => void;
}

export function WorkspaceSwitcher({
  organizationId,
  onNavigate,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);

  useEffect(() => {
    void listOrganizations()
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  }, []);

  const current = organizations.find(({ id }) => id === organizationId);

  function goTo(path: string) {
    setOpen(false);
    onNavigate?.();
    router.push(path);
  }

  return (
    <div className="relative">
      <button
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[6px] border border-slate-200 bg-white px-3 text-left hover:border-slate-300"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
            {(current?.name ?? "W").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-slate-900">
              {current?.name ?? "Choose workspace"}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
              <span>Workspace</span>
              {current?.role && (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {current.role === "OWNER" ? "Owner" : "Member"}
                </span>
              )}
            </span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-full min-w-64 rounded-[8px] border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60">
          <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Current workspace
          </p>
          {organizations.map((organization) => {
            const isCurrent = organization.id === organizationId;
            return (
              <button
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[6px] px-2.5 text-left transition-colors ${
                  isCurrent ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
                key={organization.id}
                onClick={() => goTo(`/organizations/${organization.id}`)}
              >
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] font-medium text-slate-900">
                    {organization.name}
                  </strong>
                  <small className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span>{organization.role === "OWNER" ? "Owner" : "Member"}</span>
                    {isCurrent && <span className="text-slate-700">• Current</span>}
                  </small>
                </span>
                <span className="flex items-center gap-2">
                  {organization.role === "OWNER" && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      OWNER
                    </span>
                  )}
                  {isCurrent && <Check className="size-4 shrink-0 text-slate-950" />}
                </span>
              </button>
            );
          })}
          <button
            className="mt-1 flex min-h-11 w-full items-center gap-2 border-t border-slate-100 px-2.5 text-[13px] font-medium text-slate-700"
            onClick={() => goTo("/dashboard")}
          >
            <Plus className="size-4" /> Switch workspace
          </button>
        </div>
      )}
    </div>
  );
}
