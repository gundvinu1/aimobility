// =============================================================================
// Pagination Utilities
// =============================================================================

import type { PaginationMeta, PaginationQuery } from '@ai-mos/types';
import { PAGINATION } from '@ai-mos/constants';

/**
 * Parse and normalize pagination query parameters
 */
export function parsePagination(query: PaginationQuery): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, Number(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Number(query.limit) || PAGINATION.DEFAULT_LIMIT),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build pagination metadata from total count
 */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
