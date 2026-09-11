import React from 'react';

/**
 * Compact pagination component.
 * Displays "Showing X to Y of Z items" alongside compact numeric page buttons.
 */
export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
  if (totalItems <= 0) return null;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) {
    return (
      <div className="pagination-bar">
        <span className="pagination-summary">
          Showing 1 to {totalItems} of {totalItems} items
        </span>
      </div>
    );
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers with window
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    // Show first, last, and around current
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="pagination-bar">
      <span className="pagination-summary">
        Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalItems}</strong> items
      </span>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous Page"
          title="Previous Page"
        >
          ‹
        </button>

        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="pagination-ellipsis">
                …
              </span>
            );
          }
          return (
            <button
              key={p}
              type="button"
              className={`pagination-btn ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next Page"
          title="Next Page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
