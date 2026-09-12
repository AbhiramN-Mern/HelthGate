import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePagination, createPaginatedResponse } from "../utils/pagination.js";

describe("Pagination Utility Unit Tests", () => {
  it("should default to page 1 and limit 10 when empty query is provided", () => {
    const result = parsePagination({});
    assert.equal(result.page, 1);
    assert.equal(result.limit, 10);
    assert.equal(result.skip, 0);
  });

  it("should default to page 1 and custom defaultLimit when specified", () => {
    const result = parsePagination({}, 25);
    assert.equal(result.page, 1);
    assert.equal(result.limit, 25);
    assert.equal(result.skip, 0);
  });

  it("should handle string numbers correctly", () => {
    const result = parsePagination({ page: "3", limit: "15" });
    assert.equal(result.page, 3);
    assert.equal(result.limit, 15);
    assert.equal(result.skip, 30);
  });

  it("should sanitize invalid, non-numeric, or negative page values to 1", () => {
    const result1 = parsePagination({ page: "-5", limit: "10" });
    assert.equal(result1.page, 1);

    const result2 = parsePagination({ page: "invalid", limit: "10" });
    assert.equal(result2.page, 1);

    const result3 = parsePagination({ page: 0, limit: "10" });
    assert.equal(result3.page, 1);
  });

  it("should sanitize invalid or zero limits to defaultLimit", () => {
    const result = parsePagination({ page: 1, limit: "-10" }, 10);
    assert.equal(result.limit, 10);

    const result2 = parsePagination({ page: 1, limit: "abc" }, 10);
    assert.equal(result2.limit, 10);
  });

  it("should cap limit to maxLimit (100) to prevent unreasonable database load", () => {
    const result = parsePagination({ page: 1, limit: "500" }, 10, 100);
    assert.equal(result.limit, 100);
  });

  it("should calculate correct skip values for different pages", () => {
    assert.equal(parsePagination({ page: 1, limit: 10 }).skip, 0);
    assert.equal(parsePagination({ page: 2, limit: 10 }).skip, 10);
    assert.equal(parsePagination({ page: 5, limit: 20 }).skip, 80);
  });

  it("should generate standardized pagination response envelope for multiple pages", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const response = createPaginatedResponse(items, 25, 2, 10);

    assert.deepEqual(response.data, items);
    assert.equal(response.currentPage, 2);
    assert.equal(response.totalPages, 3);
    assert.equal(response.totalItems, 25);
    assert.equal(response.itemsPerPage, 10);
    assert.equal(response.hasNextPage, true);
    assert.equal(response.hasPreviousPage, true);
  });

  it("should handle first page correctly (hasPreviousPage = false)", () => {
    const items = [{ id: 1 }, { id: 2 }];
    const response = createPaginatedResponse(items, 15, 1, 10);

    assert.equal(response.currentPage, 1);
    assert.equal(response.totalPages, 2);
    assert.equal(response.hasNextPage, true);
    assert.equal(response.hasPreviousPage, false);
  });

  it("should handle last page correctly (hasNextPage = false)", () => {
    const items = [{ id: 1 }];
    const response = createPaginatedResponse(items, 20, 2, 10);

    assert.equal(response.currentPage, 2);
    assert.equal(response.totalPages, 2);
    assert.equal(response.hasNextPage, false);
    assert.equal(response.hasPreviousPage, true);
  });

  it("should handle 0 total items cleanly", () => {
    const response = createPaginatedResponse([], 0, 1, 10);

    assert.deepEqual(response.data, []);
    assert.equal(response.currentPage, 1);
    assert.equal(response.totalPages, 0);
    assert.equal(response.totalItems, 0);
    assert.equal(response.hasNextPage, false);
    assert.equal(response.hasPreviousPage, false);
  });
});
