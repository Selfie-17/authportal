/**
 * In-memory cache for the teacher observation evaluations grid.
 * Enables instant tab switching with Stale-While-Revalidate behavior.
 */
class GridCache {
  constructor() {
    this.data = null;
    this.timestamp = 0;
  }

  get() {
    return this.data;
  }

  set(gridData) {
    this.data = gridData;
    this.timestamp = Date.now();
  }

  has() {
    return this.data !== null;
  }

  invalidate() {
    this.data = null;
    this.timestamp = 0;
  }
}

export const gridCache = new GridCache();
