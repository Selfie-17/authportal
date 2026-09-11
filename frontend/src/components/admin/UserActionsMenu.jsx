import React, { useState, useEffect, useRef } from 'react';

/**
 * Three-dot action menu (⋮) for user table rows.
 * Provides role editing and account enable/disable operations.
 * Preserves exact API handlers and safeguards.
 */
export default function UserActionsMenu({ user, isCurrentUser, onRoleChange, onStatusToggle }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRoleSubmenu, setShowRoleSubmenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu on click outside or Esc key
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowRoleSubmenu(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowRoleSubmenu(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleRoleSelect = (targetRole) => {
    if (user.role !== targetRole) {
      onRoleChange(user.id, targetRole);
    }
    setIsOpen(false);
    setShowRoleSubmenu(false);
  };

  const handleToggleStatus = () => {
    onStatusToggle(user.id, user.enabled);
    setIsOpen(false);
  };

  return (
    <div className="action-menu-container" ref={menuRef}>
      <button
        type="button"
        className={`btn-action-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          setShowRoleSubmenu(false);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="More actions"
      >
        <span className="action-trigger-dots">⋮</span>
      </button>

      {isOpen && (
        <div className="action-dropdown-menu" role="menu">
          {/* Role Change Submenu / Options */}
          <div className="action-dropdown-section">
            <span className="action-dropdown-label">Change Role</span>
            {['STUDENT', 'TEACHER', 'ADMIN'].map((role) => (
              <button
                key={role}
                type="button"
                className={`action-menu-item ${user.role === role ? 'selected' : ''}`}
                onClick={() => handleRoleSelect(role)}
                role="menuitem"
              >
                <span className="role-dot" data-role={role} />
                <span>{role}</span>
                {user.role === role && <span className="checkmark">✓</span>}
              </button>
            ))}
          </div>

          <div className="action-dropdown-divider" />

          {/* Account Status Toggle */}
          <button
            type="button"
            className={`action-menu-item danger ${isCurrentUser && user.enabled ? 'disabled' : ''}`}
            onClick={handleToggleStatus}
            disabled={isCurrentUser && user.enabled}
            title={isCurrentUser && user.enabled ? 'You cannot disable your own administrator account' : undefined}
            role="menuitem"
          >
            <span>{user.enabled ? '🛑 Disable Account' : '✅ Enable Account'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
