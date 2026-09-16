import { apiRequest } from "./client";
import type {
  Organization,
  OrganizationSummary,
} from "../../types/organizations";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  timezone: string;
}

export function createOrganization(
  input: CreateOrganizationInput,
): Promise<Organization> {
  return apiRequest<Organization>("/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listOrganizations(): Promise<OrganizationSummary[]> {
  return apiRequest<OrganizationSummary[]>("/organizations");
}

export function getOrganization(organizationId: string): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${organizationId}`);
}
