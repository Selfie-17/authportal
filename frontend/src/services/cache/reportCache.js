/**
 * In-memory cache for student evaluation reports.
 * Keyed by `${studentId.toUpperCase()}:${week.toLowerCase()}`.
 * Stores multi-provider bundled responses so switching providers takes 0ms.
 */
class ReportCache {
  constructor() {
    this.cache = new Map();
  }

  _makeKey(studentId, week) {
    if (!studentId || !week) return null;
    return `${studentId.trim().toUpperCase()}:${week.trim().toLowerCase()}`;
  }

  get(studentId, week) {
    const key = this._makeKey(studentId, week);
    if (!key) return null;
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  set(studentId, week, data) {
    const key = this._makeKey(studentId, week);
    if (key && data) {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
      });
    }
  }

  has(studentId, week) {
    const key = this._makeKey(studentId, week);
    return key ? this.cache.has(key) : false;
  }

  /**
   * Invalidates a specific student's report.
   */
  invalidate(studentId, week) {
    const key = this._makeKey(studentId, week);
    if (key) {
      this.cache.delete(key);
    }
  }

  /**
   * Invalidates all cached student reports for a specific week (e.g. after uploading a new week JSON).
   */
  invalidateWeek(week) {
    if (!week) return;
    const weekNormalized = week.trim().toLowerCase();
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${weekNormalized}`)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const reportCache = new ReportCache();
