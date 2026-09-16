import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-teal-50 text-teal-700">
          <Inbox className="size-5" />
        </span>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}
