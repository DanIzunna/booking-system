export type BookableStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Bookable {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  slug: string;
  status: BookableStatus;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookableInput {
  organizationId: string;
  name: string;
  description?: string;
  capacity: number;
}

export interface UpdateBookableInput {
  name?: string;
  description?: string;
  slug?: string;
  status?: BookableStatus;
  capacity?: number;
}
