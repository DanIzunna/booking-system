"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";

export function PublicBookingLink({
  organizationSlug,
  slug,
  enabled = true,
}: {
  organizationSlug: string;
  slug: string;
  enabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/book/${organizationSlug}/${slug}`;
  const href =
    typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copyLink() {
    await navigator.clipboard.writeText(href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!enabled)
    return (
      <span className="text-xs text-slate-400">Available after publishing</span>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 max-w-full truncate rounded-[4px] bg-slate-100 px-2 py-1 text-xs text-slate-600">
        {path}
      </code>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 min-w-11 px-3 text-xs sm:min-h-9 sm:min-w-0 sm:inline-flex"
        onClick={() => void copyLink()}
        aria-label={copied ? "Copied link" : "Copy public booking link"}
        title={copied ? "Copied" : "Copy link"}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        <span className="hidden sm:inline">
          {copied ? "Copied" : "Copy link"}
        </span>
      </Button>
      <a
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-[6px] px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:min-h-9 sm:min-w-0"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label="Open public booking page"
        title="Open public booking page"
      >
        <ExternalLink className="size-3.5" />
        <span className="hidden sm:inline">Open</span>
      </a>
    </div>
  );
}
