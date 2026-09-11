import React from 'react';

/**
 * Modern pill badge displaying user role with category-specific colors.
 */
export default function RoleBadge({ role }) {
  const normalized = (role || '').toUpperCase();

  let badgeClass = 'role-badge-default';
  let label = role || 'Unknown';

  if (normalized === 'STUDENT') {
    badgeClass = 'role-badge-student';
    label = 'STUDENT';
  } else if (normalized === 'TEACHER') {
    badgeClass = 'role-badge-teacher';
    label = 'TEACHER';
  } else if (normalized === 'ADMIN') {
    badgeClass = 'role-badge-admin';
    label = 'ADMIN';
  }

  return (
    <span className={`role-badge ${badgeClass}`}>
      {label}
    </span>
  );
}
