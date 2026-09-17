import { Badge } from "../ui/badge";
import type { BookableStatus } from "../../types/bookables";

export function BookableStatus({ status }: { status: BookableStatus }) {
  return <Badge variant={status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "neutral" : "neutral"}>{status}</Badge>;
}
