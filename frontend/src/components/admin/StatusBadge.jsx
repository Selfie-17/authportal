import React from 'react';

/**
 * Modern status pill indicating active or disabled account status.
 */
export default function StatusBadge({ enabled }) {
  return (
    <span className={`status-badge-pill ${enabled ? 'active' : 'disabled'}`}>
      <span className="status-badge-dot" />
      {enabled ? 'Active' : 'Disabled'}
    </span>
  );
}
