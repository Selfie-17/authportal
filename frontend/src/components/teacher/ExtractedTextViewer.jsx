import React, { useState, useMemo } from 'react';

/**
 * Helper to highlight search query matches in extracted text without altering raw content.
 */
function renderHighlightedText(text, query) {
  if (!query || !query.trim()) {
    return text;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, idx) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={idx} className="ocr-search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Component to display OCR-extracted text from the student's lab PDF in a clean,
 * light document-reading interface adhering to RGUKT Lab Portal design tokens.
 */
export default function ExtractedTextViewer({
  studentId,
  week,
  report,
}) {
  const ocr = report?.ocr || {};
  const source = report?.source || {};

  const fullText = ocr.text || '';
  const pageBreakdown = Array.isArray(ocr.page_breakdown) ? ocr.page_breakdown : [];
  const totalPages = ocr.num_pages || source.num_pages || (pageBreakdown.length > 0 ? pageBreakdown.length : 1);

  // Active page selection: 'ALL' or page number ('1', '2', '3'...)
  const [selectedPage, setSelectedPage] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Active pages list to render
  const pagesToDisplay = useMemo(() => {
    if (pageBreakdown.length > 0) {
      if (selectedPage === 'ALL') {
        return pageBreakdown;
      }
      const pageNum = Number(selectedPage);
      const match = pageBreakdown.find((p) => p.page === pageNum);
      return match ? [match] : pageBreakdown;
    }
    // Fallback if no page_breakdown array is present
    return [{ page: 1, text: fullText }];
  }, [selectedPage, pageBreakdown, fullText]);

  // Full text for copying
  const activeCopyText = useMemo(() => {
    if (selectedPage === 'ALL') {
      return fullText || pageBreakdown.map((p) => `--- Page ${p.page} ---\n\n${p.text}`).join('\n\n');
    }
    const pageNum = Number(selectedPage);
    const match = pageBreakdown.find((p) => p.page === pageNum);
    return match ? match.text : fullText;
  }, [selectedPage, fullText, pageBreakdown]);

  const handleCopy = () => {
    if (!activeCopyText) return;
    navigator.clipboard
      .writeText(activeCopyText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch((err) => {
        console.warn('Failed to copy to clipboard:', err);
      });
  };

  if (!fullText && pageBreakdown.length === 0) {
    return (
      <div className="portal-card extracted-text-empty-card">
        <div className="empty-state-icon">📄</div>
        <h3>No Extracted Text Available</h3>
        <p>
          The evaluation report for <strong>{studentId} ({week})</strong> does not contain OCR extracted text.
        </p>
      </div>
    );
  }

  return (
    <div className="extracted-text-container">
      {/* 1. OCR Metadata Bar (Light Badges) */}
      <div className="ocr-metadata-banner">
        <div className="ocr-meta-chips">
          {source.filename && (
            <div className="ocr-meta-chip" title="Source PDF Filename">
              <span className="ocr-chip-label">Source PDF:</span>
              <strong className="ocr-chip-value">{source.filename}</strong>
            </div>
          )}
          <div className="ocr-meta-chip" title="Total Pages Detected">
            <span className="ocr-chip-label">Pages:</span>
            <strong className="ocr-chip-value">{totalPages}</strong>
          </div>
          {ocr.status && (
            <div className="ocr-meta-chip" title="OCR Engine Extraction Status">
              <span className="ocr-chip-label">OCR Status:</span>
              <span className={`ocr-status-pill ${ocr.status === 'success' ? 'success' : 'pending'}`}>
                {ocr.status === 'success' ? '✓ Success' : ocr.status}
              </span>
            </div>
          )}
          {ocr.device && (
            <div className="ocr-meta-chip" title="Inference Acceleration Device">
              <span className="ocr-chip-label">Device:</span>
              <strong className="ocr-chip-value">{ocr.device}</strong>
            </div>
          )}
        </div>

        <div className="ocr-top-actions">
          <button
            type="button"
            className={`btn-copy-ocr ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy displayed text to clipboard"
          >
            <span>{copied ? '✓' : '📋'}</span>
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>
      </div>

      {/* 2. Light Page Navigation Tabs & Search Box */}
      <div className="ocr-controls-row">
        <div className="ocr-page-tabs" role="tablist">
          <button
            type="button"
            className={`ocr-page-tab ${selectedPage === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedPage('ALL')}
          >
            All Pages ({totalPages})
          </button>
          {pageBreakdown.length > 0 ? (
            pageBreakdown.map((p) => (
              <button
                key={p.page}
                type="button"
                className={`ocr-page-tab ${selectedPage === String(p.page) ? 'active' : ''}`}
                onClick={() => setSelectedPage(String(p.page))}
              >
                Page {p.page}
              </button>
            ))
          ) : (
            Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                className={`ocr-page-tab ${selectedPage === String(pNum) ? 'active' : ''}`}
                onClick={() => setSelectedPage(String(pNum))}
              >
                Page {pNum}
              </button>
            ))
          )}
        </div>

        <div className="ocr-search-box">
          <span className="ocr-search-icon">🔍</span>
          <input
            type="text"
            className="ocr-search-input"
            placeholder="Search keywords in text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="ocr-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 3. Document Reading Card (Pure Light Theme) */}
      <div className="ocr-text-display-card">
        <div className="ocr-text-header">
          <span className="ocr-display-heading">
            {selectedPage === 'ALL' ? 'Complete Extracted Text (All Pages)' : `Extracted Text — Page ${selectedPage}`}
          </span>
          <span className="ocr-char-count">
            {activeCopyText.length.toLocaleString()} characters
          </span>
        </div>

        <div className="ocr-document-body">
          {pagesToDisplay.map((p) => (
            <div key={p.page} className="ocr-page-section">
              {/* Soft Blue Page Badge Marker */}
              <div className="ocr-page-badge-row">
                <span className="ocr-page-chip">
                  📄 Page {p.page}
                </span>
              </div>

              <div className="ocr-page-text-flow">
                {renderHighlightedText(p.text, searchQuery)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
