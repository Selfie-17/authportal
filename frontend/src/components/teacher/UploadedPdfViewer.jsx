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
  const [pdfBytes, setPdfBytes] = useState(null);
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

  const loadPdfFromStorage = async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await evaluationService.getStudentPdfData(studentId, week, force);
      if (data) {
        setBlobUrl(data.blobUrl);
        setPdfBytes(data.uint8Array);
      }
    } catch (err) {
      console.error('Failed to load student PDF from storage:', err);
      setError(err.message || 'Original PDF is not available for this submission.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If report specifically says no PDF and we don't have cache, show missing state but allow manual retry
    if (isAvailable === false && !evaluationService.pdfCache.has(studentId, week)) {
      setLoading(false);
      setError('Original PDF is not available for this submission.');
      return;
    }

    loadPdfFromStorage(false);

    return () => {
      // NOTE: Do NOT revoke the blob URL here! pdfCache owns the blob URL and re-uses it across tab mounts.
    };
  }, [studentId, week, isAvailable]);

  // Load PDF with PDF.js for pure light canvas rendering
  useEffect(() => {
    if (!pdfBytes && !blobUrl) return;

    let cancel = false;
    let loadingTask = null;

    try {
      // Pass Uint8Array binary data directly to prevent worker CORS / blob-fetch issues
      const source = pdfBytes ? { data: pdfBytes } : { url: blobUrl };
      loadingTask = pdfjsLib.getDocument(source);

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
    } catch (err) {
      console.warn('PDF.js task init failed:', err);
      if (!cancel) {
        setPdfJsError(true);
        setViewerMode('browser');
      }
    }

    return () => {
      cancel = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfBytes, blobUrl]);

  const handleDownload = () => {
    evaluationService.downloadStudentPdf(studentId, week, sourceFilename);
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
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
          {error || `The evaluation report for ${studentId} (${week}) was processed from OCR data, but the student has not uploaded their PDF lab report file through the student submission portal, or the file was not found in storage.`}
        </p>

        <div className="pdf-missing-meta-box">
          <div><span>Student ID:</span> <strong>{studentId}</strong></div>
          <div><span>Evaluation Cycle:</span> <strong>{week}</strong></div>
          {report?.sectionId && <div><span>Section:</span> <strong>{report.sectionId}</strong></div>}
          {sourceFilename && <div><span>Source File Noted in Report:</span> <code>{sourceFilename}</code></div>}
        </div>

        <button
          type="button"
          className="btn-secondary btn-sm"
          style={{ marginTop: '1.25rem' }}
          onClick={() => loadPdfFromStorage(true)}
        >
          <span>🔄</span> Re-check Cloud Storage (Backblaze B2)
        </button>
      </div>
    );
  }

  return (
    <div className="uploaded-pdf-container">
      {/* Unified Header with Download PDF beside title */}
      <div className="side-by-side-col-header">
        <div className="col-header-left">
          <span className="side-col-title">📄 Student Uploaded PDF</span>
          {numPages > 0 && (
            <span className="col-header-badge">
              {numPages} {numPages === 1 ? 'Page' : 'Pages'}
            </span>
          )}
          {viewerMode === 'light' && !pdfJsError && (
            <div className="pdf-zoom-inline" title="Adjust PDF zoom">
              <button
                type="button"
                className="btn-zoom-mini"
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                −
              </button>
              <span className="zoom-level-text-mini">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="btn-zoom-mini"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className="btn-zoom-reset-mini"
                onClick={handleResetZoom}
                title="Reset zoom to 115%"
              >
                Fit
              </button>
            </div>
          )}
        </div>

        <div className="col-header-actions">
          <button
            type="button"
            className="btn-header-action secondary"
            onClick={handleOpenInNewTab}
            title="Open PDF in a new browser window"
          >
            <span>↗</span>
            <span>Open</span>
          </button>
          <button
            type="button"
            className="btn-header-action primary"
            onClick={handleDownload}
            title={`Download ${sourceFilename}`}
          >
            <span>⬇</span>
            <span>Download PDF</span>
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
