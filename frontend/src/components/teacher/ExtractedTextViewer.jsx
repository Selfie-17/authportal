import React, { useState, useMemo } from 'react';
import { renderMathNodes, renderMathInHtml } from '../../utils/mathRenderer';

/**
 * Helper to render math formulas ($...$, $$...$$, LaTeX) and special characters,
 * while highlighting search query matches.
 */
function renderHighlightedText(text, query) {
  if (!text) return '';
  return renderMathNodes(text, query);
}

/**
 * Detects whether a string contains HTML markup (e.g. <table>, <p>, <div>, <h1-6>, <br>, etc.).
 */
function containsHtml(str) {
  if (!str || typeof str !== 'string') return false;
  return /<([a-z]+)(\s[^>]*)?>[\s\S]*<\/\1>|<(br|hr|img|input)\s*\/?>/i.test(str);
}

/**
 * Sanitizes dirty HTML strings using browser DOMParser and highlights search query matches.
 * Strips script, iframe, embed, and inline event handlers to prevent XSS.
 */
function sanitizeAndHighlightHtml(dirtyHtml, query) {
  if (!dirtyHtml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirtyHtml, 'text/html');

    // Strip dangerous tags
    const forbidden = doc.querySelectorAll('script, iframe, object, embed, base, link, meta, style, applet');
    forbidden.forEach((el) => el.remove());

    // Strip dangerous attributes (on*, javascript: URIs)
    const allElements = doc.body.querySelectorAll('*');
    allElements.forEach((el) => {
      for (let i = el.attributes.length - 1; i >= 0; i--) {
        const attr = el.attributes[i];
        const name = attr.name.toLowerCase();
        const val = attr.value.toLowerCase().trim();
        if (name.startsWith('on') || val.startsWith('javascript:') || val.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      }
    });

    // Highlight search keywords inside text nodes
    if (query && query.trim()) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && regex.test(node.nodeValue)) {
          textNodes.push(node);
        }
      }
      textNodes.forEach((textNode) => {
        const parent = textNode.parentNode;
        if (!parent || parent.nodeName === 'MARK') return;
        const parts = textNode.nodeValue.split(regex);
        const frag = doc.createDocumentFragment();
        parts.forEach((part) => {
          if (part.toLowerCase() === query.toLowerCase()) {
            const mark = doc.createElement('mark');
            mark.className = 'ocr-search-highlight';
            mark.textContent = part;
            frag.appendChild(mark);
          } else if (part) {
            frag.appendChild(doc.createTextNode(part));
          }
        });
        parent.replaceChild(frag, textNode);
      });
    }

    return renderMathInHtml(doc.body.innerHTML);
  } catch (err) {
    console.warn('HTML sanitization error:', err);
    return renderMathInHtml(dirtyHtml);
  }
}

/**
 * Component to display OCR-extracted text from the student's lab PDF in a clean,
 * light document-reading interface. Automatically detects and renders HTML markup
 * with interactive toggle between Formatted HTML and Raw Text.
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
  const [renderHtmlMode, setRenderHtmlMode] = useState(true);

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

  // Determine whether any displayed page contains HTML code
  const hasHtmlContent = useMemo(() => {
    return pagesToDisplay.some((p) => containsHtml(p.text));
  }, [pagesToDisplay]);

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
      {/* Single-Row Unified OCR Toolbar:
          [ 📄 OCR │ All │ 1 │ 2 │ 3 │ 4 │ 5 │ 🔍 Search... │ 📋 ] */}
      <div className="ocr-unified-toolbar">
        {/* Left (Fixed): Shortened Title */}
        <div className="ocr-toolbar-left">
          <span className="side-col-title">📄 OCR</span>
          {hasHtmlContent && (
            <span className="col-header-badge html-badge" title="HTML formatted text detected">
              HTML
            </span>
          )}
        </div>

        <div className="ocr-toolbar-divider" />

        {/* Center (Scrollable): Numbered Page Buttons (1, 2, 3...) */}
        <div className="ocr-toolbar-pages-scroll" role="tablist" title="Scroll horizontally for pages">
          <button
            type="button"
            className={`ocr-page-btn-compact ${selectedPage === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedPage('ALL')}
            title="View all pages"
          >
            All
          </button>
          {pageBreakdown.length > 0 ? (
            pageBreakdown.map((p) => (
              <button
                key={p.page}
                type="button"
                className={`ocr-page-btn-compact ${selectedPage === String(p.page) ? 'active' : ''}`}
                onClick={() => setSelectedPage(String(p.page))}
                title={`Page ${p.page}`}
              >
                {p.page}
              </button>
            ))
          ) : (
            Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                className={`ocr-page-btn-compact ${selectedPage === String(pNum) ? 'active' : ''}`}
                onClick={() => setSelectedPage(String(pNum))}
                title={`Page ${pNum}`}
              >
                {pNum}
              </button>
            ))
          )}
        </div>

        <div className="ocr-toolbar-divider" />

        {/* Right (Fixed): Search + (Optional HTML toggle) + Copy Text (Icon Only) */}
        <div className="ocr-toolbar-right">
          <div className="ocr-search-compact">
            <span className="ocr-search-icon-compact">🔍</span>
            <input
              type="text"
              className="ocr-search-input-compact"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="ocr-search-clear-compact"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {hasHtmlContent && (
            <div className="ocr-mode-toggle-compact" title="Switch HTML rendering mode">
              <button
                type="button"
                className={`btn-mode-toggle-compact ${renderHtmlMode ? 'active' : ''}`}
                onClick={() => setRenderHtmlMode(true)}
                title="Render formatted HTML"
              >
                Rendered
              </button>
              <button
                type="button"
                className={`btn-mode-toggle-compact ${!renderHtmlMode ? 'active' : ''}`}
                onClick={() => setRenderHtmlMode(false)}
                title="View raw OCR markup"
              >
                Raw
              </button>
            </div>
          )}

          <button
            type="button"
            className={`btn-header-action icon-only ${copied ? 'copied' : 'secondary'}`}
            onClick={handleCopy}
            title={copied ? 'Copied to clipboard!' : 'Copy OCR text'}
          >
            <span>{copied ? '✓' : '📋'}</span>
          </button>
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
          {pagesToDisplay.map((p) => {
            const pageHasHtml = containsHtml(p.text);
            return (
              <div key={p.page} className="ocr-page-section">
                {/* Soft Blue Page Badge Marker */}
                <div className="ocr-page-badge-row">
                  <span className="ocr-page-chip">
                    📄 Page {p.page}
                  </span>
                  {pageHasHtml && renderHtmlMode && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#16a34a',
                        background: '#f0fdf4',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      HTML Rendered
                    </span>
                  )}
                </div>

                {pageHasHtml && renderHtmlMode ? (
                  <div
                    className="ocr-html-container"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeAndHighlightHtml(p.text, searchQuery),
                    }}
                  />
                ) : (
                  <div className="ocr-page-text-flow">
                    {renderHighlightedText(p.text, searchQuery)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
