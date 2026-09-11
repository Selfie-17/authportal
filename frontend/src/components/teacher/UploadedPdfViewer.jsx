import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { evaluationService } from '../../services/evaluationService';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Individual PDF Page Canvas Renderer for High-DPI Light Document Display
 */
function PdfPageCanvas({ pdfDoc, pageNumber, scale }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    let renderTask = null;

    if (!pdfDoc || !canvasRef.current) return;

    setLoading(true);

    pdfDoc.getPage(pageNumber).then((page) => {
      if (cancel) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      renderTask = page.render({
        canvasContext: ctx,
        transform,
        viewport,
      });

      renderTask.promise
        .then(() => {
          if (!cancel) setLoading(false);
        })
        .catch((err) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn(`Error rendering page ${pageNumber}:`, err);
          }
        });
    });

    return () => {
      cancel = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div className="pdf-page-sheet-container">
      <div className="pdf-page-number-banner">
        <span className="pdf-page-number-pill">Page {pageNumber}</span>
      </div>
      <div className="pdf-canvas-shadow-wrap">
        <canvas ref={canvasRef} className="pdf-page-canvas" />
        {loading && <div className="pdf-canvas-spinner-overlay">Loading page {pageNumber}...</div>}
      </div>
    </div>
  );
}

/**
 * Pure Light-Themed Component to stream and render the student's uploaded lab PDF report.
 * Uses authoritative mapping: Student + Week + Section -> Submission -> SubmissionFile(PDF_REPORT) -> Backblaze B2.
 */
export default function UploadedPdfViewer({
  studentId,
  week,
  report,
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // PDF.js State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [viewerMode, setViewerMode] = useState('light'); // 'light' | 'browser'
  const [pdfJsError, setPdfJsError] = useState(false);

  const sourceFilename = report?.pdfFilename || report?.source?.filename || 'observation_report.pdf';
  const isAvailable = report?.pdfAvailable;

  useEffect(() => {
    let currentBlob = null;
    let isMounted = true;

    const fetchPdf = async () => {
      if (isAvailable === false) {
        setLoading(false);
        setError('Original PDF is not available for this submission.');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const url = await evaluationService.getStudentPdfBlobUrl(studentId, week);
        if (isMounted) {
          currentBlob = url;
          setBlobUrl(url);
        } else {
          window.URL.revokeObjectURL(url);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Original PDF is not available for this submission.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      isMounted = false;
      if (currentBlob) {
        window.URL.revokeObjectURL(currentBlob);
      }
    };
  }, [studentId, week, isAvailable]);

  // Load PDF with PDF.js for pure light canvas rendering
  useEffect(() => {
    if (!blobUrl) return;

    let cancel = false;
    const loadingTask = pdfjsLib.getDocument({ url: blobUrl });

    loadingTask.promise
      .then((loadedPdf) => {
        if (!cancel) {
          setPdfDoc(loadedPdf);
          setNumPages(loadedPdf.numPages);
          setPdfJsError(false);
        }
      })
      .catch((err) => {
        console.warn('PDF.js loading failed, falling back to browser iframe:', err);
        if (!cancel) {
          setPdfJsError(true);
          setViewerMode('browser');
        }
      });

    return () => {
      cancel = true;
      loadingTask.destroy().catch(() => {});
    };
  }, [blobUrl]);

  const handleDownload = () => {
    evaluationService.downloadStudentPdf(studentId, week, sourceFilename);
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.6, +(prev - 0.15).toFixed(2)));
  };

  const handleResetZoom = () => {
    setScale(1.15);
  };

  // Loading state
  if (loading) {
    return (
      <div className="portal-card pdf-loading-card">
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <h3>Retrieving Student PDF...</h3>
        <p>Loading authoritative submission document for <strong>{studentId} ({week})</strong> from cloud storage.</p>
      </div>
    );
  }

  // Missing or Error state
  if (error || !blobUrl) {
    return (
      <div className="portal-card pdf-missing-card">
        <div className="pdf-missing-icon">📑</div>
        <h3 className="pdf-missing-title">Original PDF is not available for this submission.</h3>
        <p className="pdf-missing-desc">
          The evaluation report for <strong>{studentId} ({week})</strong> was processed from OCR data,
          but the student has not uploaded their PDF lab report file through the student submission portal, or the file was not found in storage.
        </p>

        <div className="pdf-missing-meta-box">
          <div><span>Student ID:</span> <strong>{studentId}</strong></div>
          <div><span>Evaluation Cycle:</span> <strong>{week}</strong></div>
          {report?.sectionId && <div><span>Section:</span> <strong>{report.sectionId}</strong></div>}
          {sourceFilename && <div><span>Source File Noted in Report:</span> <code>{sourceFilename}</code></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="uploaded-pdf-container">
      {/* Light PDF Action Toolbar */}
      <div className="pdf-toolbar">
        {/* Left: Metadata info */}
        <div className="pdf-toolbar-info">
          <span className="pdf-toolbar-badge">
            📄 <strong>{sourceFilename}</strong>
          </span>
          <span className="pdf-toolbar-student">
            {studentId} • {week}
          </span>
          {numPages > 0 && (
            <span className="pdf-toolbar-pages-chip">
              {numPages} {numPages === 1 ? 'Page' : 'Pages'}
            </span>
          )}
        </div>

        {/* Center: Zoom and Mode Controls */}
        <div className="pdf-toolbar-center">
          {viewerMode === 'light' && (
            <div className="pdf-zoom-controls">
              <button
                type="button"
                className="btn-zoom"
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                −
              </button>
              <span className="zoom-level-text">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="btn-zoom"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className="btn-zoom-reset"
                onClick={handleResetZoom}
                title="Reset to 115%"
              >
                Fit
              </button>
            </div>
          )}

          {!pdfJsError && (
            <div className="pdf-mode-toggle" title="Switch viewer rendering mode">
              <button
                type="button"
                className={`btn-mode-toggle ${viewerMode === 'light' ? 'active' : ''}`}
                onClick={() => setViewerMode('light')}
              >
                ☀️ Light Viewer
              </button>
              <button
                type="button"
                className={`btn-mode-toggle ${viewerMode === 'browser' ? 'active' : ''}`}
                onClick={() => setViewerMode('browser')}
              >
                🌐 Browser Native
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="pdf-toolbar-actions">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={handleOpenInNewTab}
            title="Open PDF in a new browser window"
          >
            <span>↗️</span> Open in New Tab
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={handleDownload}
            title={`Download ${sourceFilename}`}
          >
            <span>⬇️</span> Download PDF
          </button>
        </div>
      </div>

      {/* PDF Viewer Body */}
      {viewerMode === 'light' && !pdfJsError && pdfDoc ? (
        <div className="pdf-light-canvas-scroll-view">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PdfPageCanvas
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              scale={scale}
            />
          ))}
        </div>
      ) : (
        <div className="pdf-viewer-frame-wrap">
          <iframe
            src={blobUrl}
            title={`Student PDF - ${studentId} - ${week}`}
            className="uploaded-pdf-iframe"
            type="application/pdf"
            style={{ colorScheme: 'light' }}
          />
        </div>
      )}
    </div>
  );
}
