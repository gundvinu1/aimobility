// =============================================================================
// Pagination Types
// =============================================================================

/** Pagination query parameters */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Paginated response meta */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Cursor-based pagination query */
export interface CursorPaginationQuery {
  cursor?: string;
  limit?: number;
}

/** Cursor-based paginated response */
export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
