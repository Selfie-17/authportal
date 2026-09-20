/**
 * In-memory cache for student submission PDF data and Blob URLs.
 * Keyed by `${studentId.toUpperCase()}:${week.toLowerCase()}`.
 * Prevents re-downloading multi-megabyte PDFs from Backblaze B2 when switching tabs or AI models.
 */
class PdfCache {
  constructor() {
    this.cache = new Map();
  }

  _makeKey(studentId, week) {
    if (!studentId || !week) return null;
    return `${studentId.trim().toUpperCase()}:${week.trim().toLowerCase()}`;
  }

  get(studentId, week) {
    const key = this._makeKey(studentId, week);
    return key ? this.cache.get(key) : null;
  }

  set(studentId, week, data) {
    const key = this._makeKey(studentId, week);
    if (key && data) {
      this.cache.set(key, data);
    }
  }

  has(studentId, week) {
    const key = this._makeKey(studentId, week);
    return key ? this.cache.has(key) : false;
  }

  revoke(studentId, week) {
    const key = this._makeKey(studentId, week);
    if (key && this.cache.has(key)) {
      const entry = this.cache.get(key);
      const url = typeof entry === 'string' ? entry : entry?.blobUrl;
      if (url) {
        try {
          window.URL.revokeObjectURL(url);
        } catch (ignored) {}
      }
      this.cache.delete(key);
    }
  }

  clear() {
    for (const entry of this.cache.values()) {
      const url = typeof entry === 'string' ? entry : entry?.blobUrl;
      if (url) {
        try {
          window.URL.revokeObjectURL(url);
        } catch (ignored) {}
      }
    }
    this.cache.clear();
  }
}

export const pdfCache = new PdfCache();
