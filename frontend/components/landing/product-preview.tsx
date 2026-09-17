import { CalendarDays, Copy, Globe2, UsersRound } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Separator } from "../ui/separator";

export function ProductPreview() {
  return (
    <Card className="overflow-hidden shadow-sm shadow-slate-200/60">
      <CardHeader className="flex items-center justify-between bg-slate-50">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Bookable preview
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            Consultation Session
          </p>
        </div>
        <Badge variant="success">
          <span className="size-1.5 rounded-full bg-green-600" /> Published
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            Availability
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-slate-500">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <span className="h-2 rounded-full bg-slate-950" />
            <span className="h-2 rounded-full bg-slate-950" />
            <span className="h-2 rounded-full bg-slate-950" />
            <span className="h-2 rounded-full bg-slate-950" />
            <span className="h-2 rounded-full bg-slate-950" />
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-[6px] border border-slate-200 bg-white px-3 py-3 text-sm">
            <CalendarDays className="size-4 text-slate-500" aria-hidden="true" />
            <span className="font-medium text-slate-800">09:00 – 17:00</span>
            <span className="ml-auto text-xs text-slate-500">Africa/Lagos</span>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <div className="flex items-center gap-3 rounded-[6px] border border-slate-200 px-3 py-3">
            <UsersRound className="size-4 text-slate-500" aria-hidden="true" />
            <span className="text-xs text-slate-500">Capacity</span>
            <strong className="ml-auto text-sm tabular-nums text-slate-950">
              1
            </strong>
          </div>
          <div className="flex items-center gap-3 rounded-[6px] border border-slate-200 px-3 py-3">
            <Globe2 className="size-4 text-slate-500" aria-hidden="true" />
            <span className="text-xs text-slate-500">Public link</span>
            <strong className="ml-auto truncate text-xs font-medium text-slate-950">
              /book/consultation-session
            </strong>
          </div>
          <Separator />
          <button className="flex min-h-10 items-center justify-center gap-2 rounded-[6px] border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50">
            <Copy className="size-3.5" aria-hidden="true" /> Copy link
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
