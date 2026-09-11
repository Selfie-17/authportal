import React from 'react';

/**
 * Compact SaaS-style Admin Metric Card.
 * Displays category icon, title, large count value, and descriptive subtitle.
 */
export default function AdminStatCard({ icon, label, value, subtitle, accentColor = 'var(--color-primary)' }) {
  return (
    <div className="admin-stat-card" style={{ '--card-accent': accentColor }}>
      <div className="admin-stat-top">
        <div className="admin-stat-icon" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
          {icon}
        </div>
        <span className="admin-stat-label">{label}</span>
      </div>
      <div className="admin-stat-value" style={{ color: accentColor }}>
        {value ?? 0}
      </div>
      {subtitle && <p className="admin-stat-subtitle">{subtitle}</p>}
    </div>
  );
}
