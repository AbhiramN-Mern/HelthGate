export interface PaginationQuery {
  page?: unknown;
  limit?: unknown;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Validates and normalizes pagination parameters.
 * - Defaults page to 1 if missing, invalid, or < 1.
 * - Defaults limit to defaultLimit (10) if missing or < 1.
 * - Caps limit at maxLimit (100) to prevent unreasonable loads.
 * - Calculates skip offset for MongoDB queries.
 */
export const parsePagination = (
  query?: PaginationQuery,
  defaultLimit = 10,
  maxLimit = 100,
): ParsedPagination => {
  let page = parseInt(String(query?.page ?? 1), 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(String(query?.limit ?? defaultLimit), 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Builds the standardized pagination metadata envelope.
 */
export const createPaginatedResponse = <T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): PaginatedResult<T> => {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    data: items,
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
};
