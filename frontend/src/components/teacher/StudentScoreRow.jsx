import React from 'react';
import WeekScoreCell from './WeekScoreCell';
import ExpandedWeekReport from './ExpandedWeekReport';
import { deriveEngineering, deriveSection } from '../../utils/studentDataHelper';

// Palette of clean modern avatar background colors
const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f97316', // orange
  '#a855f7', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6366f1', // indigo
];

/**
 * Renders an individual student row within the common Week 1–12 table,
 * plus an inline detail row when a week score is clicked or expanded.
 */
export default function StudentScoreRow({
  rowIndex,
  row,
  studentMeta = {},
  expandedWeek,
  onToggleWeek,
  onViewReport,
  onDeleteReport,
}) {
  const studentId = (row.studentId || '').toUpperCase();
  const evaluations = row.evaluations || {};

  // 1. Primary: Student ID
  // 2. Secondary: Clean Student Name (strip duplicated studentId prefix if present)
  const rawName = studentMeta.name || row.studentName || '';
  let cleanName = rawName;
  if (studentId && cleanName) {
    cleanName = cleanName.replace(new RegExp('^' + studentId + '[-_\\s:]*', 'i'), '').trim();
  }
  const studentName = cleanName || rawName || (studentMeta.email ? studentMeta.email.split('@')[0] : studentId);

  // 3. Tertiary: Derived Engineering Year and Section
  const engObj = deriveEngineering(studentId, studentMeta.year || row.year);
  const secStr = deriveSection(studentId, studentMeta.section || row.section, row.sectionId);
  const academicTag = `${engObj.label} • Section ${secStr}`;

  // Resolve Profile Picture & Avatar Initial
  const profilePicture = studentMeta.profilePicture || row.profilePicture || null;
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  // Use studentId initial as shown in the visual reference (e.g. 'N')
  const initial = studentId.length > 0 ? studentId.charAt(0) : 'S';
  const colorIndex = Math.abs(studentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  const avatarBg = AVATAR_COLORS[colorIndex];

  const showImg = Boolean(profilePicture && !imgError);

  // List of all evaluated week keys for this student
  const evaluatedWeeks = Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`).filter(
    (w) => !!evaluations[w]
  );

  const isAnyExpanded = !!expandedWeek;

  // Week-aware Action Chevron handler:
  // 1. If a week is currently expanded: collapse it.
  // 2. If no week is expanded: expand the first available evaluated week.
  const handleActionClick = () => {
    if (isAnyExpanded) {
      onToggleWeek(expandedWeek); // collapse
    } else if (evaluatedWeeks.length > 0) {
      onToggleWeek(evaluatedWeeks[0]); // expand first evaluated week
    }
  };

  const activeEvaluation = expandedWeek ? evaluations[expandedWeek] : null;

  return (
    <>
      <tr className={`student-score-tr ${isAnyExpanded ? 'has-expanded-week' : ''}`}>
        {/* 1. Row Index */}
        <td className="row-index-td">{rowIndex}</td>

        {/* 2. Student Identity: Compact Avatar + [ID, Name, Academic Tag] */}
        <td className="student-info-td">
          <div className="student-profile-cell">
            <div className="student-avatar-wrapper">
              {showImg && (
                <img
                  src={profilePicture}
                  alt={studentName || studentId}
                  className={`student-avatar-img ${imgLoaded ? 'loaded' : 'loading'}`}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                  loading="lazy"
                  style={{ display: imgLoaded ? 'block' : 'none' }}
                />
              )}
              {(!showImg || !imgLoaded) && (
                <div
                  className="student-avatar-badge"
                  style={{ backgroundColor: avatarBg }}
                  aria-hidden="true"
                >
                  {initial}
                </div>
              )}
            </div>
            <div className="student-profile-details">
              <div className="student-id-text">{studentId}</div>
              <div className="student-name-text" title={studentName}>
                {studentName}
              </div>
              <div className="student-academic-text">{academicTag}</div>
            </div>
          </div>
        </td>

        {/* 3. Weeks 1 to 12 Columns */}
        {Array.from({ length: 12 }, (_, i) => {
          const weekName = `Week ${i + 1}`;
          const ev = evaluations[weekName];
          const isActive = expandedWeek === weekName;

          return (
            <WeekScoreCell
              key={weekName}
              weekName={weekName}
              evaluation={ev}
              isActive={isActive}
              onToggleWeek={onToggleWeek}
            />
          );
        })}

        {/* 4. Action Chevron Column */}
        <td className="action-col-td">
          <button
            type="button"
            className={`btn-row-chevron ${isAnyExpanded ? 'open' : ''}`}
            onClick={handleActionClick}
            disabled={evaluatedWeeks.length === 0}
            title={
              evaluatedWeeks.length === 0
                ? 'No evaluations available for this student'
                : isAnyExpanded
                ? 'Collapse student week report'
                : 'Expand student week report'
            }
            aria-expanded={isAnyExpanded}
            aria-label={isAnyExpanded ? 'Collapse student week report' : 'Expand student week report'}
          >
            {isAnyExpanded ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </button>
        </td>
      </tr>

      {/* Inline Expanded Detail Row */}
      {isAnyExpanded && activeEvaluation && (
        <tr className="expanded-detail-tr">
          <td colSpan={15} className="expanded-detail-td">
            <ExpandedWeekReport
              studentId={studentId}
              weekName={expandedWeek}
              evaluation={activeEvaluation}
              onViewReport={onViewReport}
              onDeleteReport={onDeleteReport}
            />
          </td>
        </tr>
      )}
    </>
  );
}
