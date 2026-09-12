import React from 'react'
import './Pagination.css'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  itemsPerPage?: number
  onPageChange: (page: number) => void
  loading?: boolean
  itemLabel?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  onPageChange,
  loading = false,
  itemLabel = 'items',
}) => {
  if (totalPages <= 1 && (!totalItems || totalItems <= itemsPerPage)) {
    return null
  }

  const handlePrevious = () => {
    if (currentPage > 1 && !loading) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages && !loading) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageClick = (page: number) => {
    if (page !== currentPage && !loading && page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  // Calculate pages to show with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const delta = 1
    const range: number[] = []
    const rangeWithDots: (number | 'ellipsis')[] = []
    let l: number | undefined

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i)
      }
    }

    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1)
        } else if (i - l !== 1) {
          rangeWithDots.push('ellipsis')
        }
      }
      rangeWithDots.push(i)
      l = i
    }

    return rangeWithDots
  }

  const startItem = totalItems !== undefined ? (currentPage - 1) * itemsPerPage + 1 : undefined
  const endItem =
    totalItems !== undefined ? Math.min(currentPage * itemsPerPage, totalItems) : undefined

  return (
    <div className={`hg-pagination-container ${loading ? 'is-loading' : ''}`} aria-label="Pagination Navigation">
      {/* Information text */}
      {totalItems !== undefined && totalItems > 0 && (
        <div className="hg-pagination-info">
          Showing <span className="hg-pagination-highlight">{startItem}</span> to{' '}
          <span className="hg-pagination-highlight">{endItem}</span> of{' '}
          <span className="hg-pagination-highlight">{totalItems}</span> {itemLabel}
        </div>
      )}

      {/* Navigation buttons */}
      <nav className="hg-pagination-controls" aria-label="Page navigation">
        <button
          type="button"
          className="hg-pagination-btn hg-pagination-nav"
          onClick={handlePrevious}
          disabled={currentPage <= 1 || loading}
          aria-label="Go to previous page"
        >
          <svg
            className="hg-pagination-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="hg-pagination-btn-text">Previous</span>
        </button>

        <div className="hg-pagination-numbers">
          {getPageNumbers().map((pageItem, index) => {
            if (pageItem === 'ellipsis') {
              return (
                <span key={`ellipsis-${index}`} className="hg-pagination-ellipsis" aria-hidden="true">
                  &hellip;
                </span>
              )
            }

            const isCurrent = pageItem === currentPage
            return (
              <button
                key={`page-${pageItem}`}
                type="button"
                className={`hg-pagination-btn hg-pagination-num ${isCurrent ? 'active' : ''}`}
                onClick={() => handlePageClick(pageItem)}
                disabled={loading}
                aria-label={`Page ${pageItem}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {pageItem}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="hg-pagination-btn hg-pagination-nav"
          onClick={handleNext}
          disabled={currentPage >= totalPages || loading}
          aria-label="Go to next page"
        >
          <span className="hg-pagination-btn-text">Next</span>
          <svg
            className="hg-pagination-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </nav>
    </div>
  )
}
