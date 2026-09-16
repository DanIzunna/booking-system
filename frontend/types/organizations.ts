export type MembershipRole = "OWNER" | "MEMBER";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  organizationId: string;
  role: MembershipRole;
}

export interface OrganizationSummary extends Organization, OrganizationMembership {}