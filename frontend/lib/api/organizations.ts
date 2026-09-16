import { apiRequest } from "./client";
import type { Organization, OrganizationSummary } from "../../types/organizations";

export function listOrganizations(): Promise<OrganizationSummary[]> {
  return apiRequest<OrganizationSummary[]>("/organizations");
}

export function getOrganization(organizationId: string): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${organizationId}`);
}