"use client";

import PublicBookingPage from "../../../../components/public-booking/public-bookable-page";

interface PublicBookableRouteProps {
  params: Promise<{ organizationSlug: string; bookableSlug: string }>;
}

export default function PublicBookableRoute({
  params,
}: PublicBookableRouteProps) {
  return <PublicBookingPage params={params} />;
}
