import React from 'react';

/**
 * Filter Section for Teacher Dashboard.
 * Matches the reference image layout:
 * [Engineering] [Section] [Search Student Input] [Search Button] [Clear Filters Button]
 * Showing X of Y students
 */
export default function ReportFilters({
  engineering,
  setEngineering,
  section,
  setSection,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  totalCount,
  filteredCount,
  onClear,
}) {
  const hasActiveFilters =
    engineering !== 'ALL' ||
    section !== 'ALL' ||
    searchQuery.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearchSubmit) onSearchSubmit();
  };

  return (
    <div className="teacher-filter-card">
      <form onSubmit={handleSubmit} className="teacher-filter-row">
        {/* Engineering Dropdown */}
        <div className="filter-group">
          <label className="filter-field-label" htmlFor="filter-engineering">Engineering</label>
          <select
            id="filter-engineering"
            className="filter-field-select"
            value={engineering}
            onChange={(e) => setEngineering(e.target.value)}
          >
            <option value="ALL">All Engineering</option>
            <option value="E1">Engineering 1</option>
            <option value="E2">Engineering 2</option>
            <option value="E3">Engineering 3</option>
            <option value="E4">Engineering 4</option>
          </select>
        </div>

        {/* Section Dropdown */}
        <div className="filter-group">
          <label className="filter-field-label" htmlFor="filter-section">Section</label>
          <select
            id="filter-section"
            className="filter-field-select"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="ALL">All Sections</option>
            {[1, 2, 3, 4, 5, 6].map((sec) => (
              <option key={sec} value={String(sec)}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Search Student Input */}
        <div className="filter-group search-group">
          <label className="filter-field-label" htmlFor="filter-search">Search Student</label>
          <div className="filter-search-box">
            <span className="search-prefix-icon">🔍</span>
            <input
              id="filter-search"
              type="text"
              className="filter-search-text"
              placeholder="Search Student ID (e.g. N241003) or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Buttons: Search & Clear */}
        <div className="filter-buttons-group">
          <button
            type="submit"
            className="btn-filter-search"
            title="Apply search"
          >
            🔍 Search
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-filter-clear"
              onClick={onClear}
              title="Reset all filters to default"
            >
              Clear Filters
            </button>
          )}
        </div>
      </form>

      {/* Showing count indicator underneath */}
      <div className="filter-status-row">
        <span className="showing-students-text">
          Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> students
        </span>
      </div>
    </div>
  );
}
