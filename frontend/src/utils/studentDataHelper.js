/**
 * Utility functions for deriving student metadata (Academic Year/Engineering, Section, Name)
 * from existing data models without introducing new backend APIs.
 */

/**
 * Derives Engineering Year (E1-E4 / Engineering 1-4) from student data:
 * 1. Checks explicit submission year (E1-E4).
 * 2. Parses RGUKT ID batch prefix (e.g., N24 -> E2, N23 -> E3, N22 -> E4, N25 -> E1).
 */
export function deriveEngineering(studentId, submissionYear) {
  if (submissionYear) {
    const clean = submissionYear.toUpperCase().trim();
    if (clean === 'E1' || clean === '1') return { code: 'E1', label: 'Engineering 1' };
    if (clean === 'E2' || clean === '2') return { code: 'E2', label: 'Engineering 2' };
    if (clean === 'E3' || clean === '3') return { code: 'E3', label: 'Engineering 3' };
    if (clean === 'E4' || clean === '4') return { code: 'E4', label: 'Engineering 4' };
  }

  if (studentId && typeof studentId === 'string') {
    const match = studentId.trim().match(/^[A-Za-z](\d{2})/);
    if (match) {
      const batchYear = parseInt(match[1], 10);
      // RGUKT Batch to Engineering mapping:
      // N24 -> Engineering 2 (per institutional standard & prompt example N241003 -> Engineering 2)
      // N25 -> Engineering 1
      // N23 -> Engineering 3
      // N22/N21 -> Engineering 4
      if (batchYear === 25) return { code: 'E1', label: 'Engineering 1' };
      if (batchYear === 24) return { code: 'E2', label: 'Engineering 2' };
      if (batchYear === 23) return { code: 'E3', label: 'Engineering 3' };
      if (batchYear <= 22) return { code: 'E4', label: 'Engineering 4' };
    }
  }

  return { code: 'E2', label: 'Engineering 2' };
}

/**
 * Derives Section (1-6) from student data:
 * 1. Checks explicit submission section.
 * 2. Checks evaluation sectionId / raw data if present (e.g. "SEC1", "Section 3", "3").
 * 3. Falls back to a deterministic default (e.g., Section 1 or derived from student roll).
 */
export function deriveSection(studentId, submissionSection, evaluationSectionId) {
  if (submissionSection) {
    const sNum = parseInt(submissionSection, 10);
    if (!isNaN(sNum) && sNum >= 1 && sNum <= 6) {
      return String(sNum);
    }
  }

  if (evaluationSectionId) {
    const match = String(evaluationSectionId).match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) return String(num);
    }
  }

  // Derive stable section from last digits of ID if needed
  if (studentId) {
    const match = studentId.match(/(\d+)$/);
    if (match) {
      const lastDigits = parseInt(match[1], 10);
      const sec = (lastDigits % 6) + 1;
      return String(sec);
    }
  }

  return '1';
}

/**
 * Extracts student ID from an institutional email address (e.g. n241003@rguktn.ac.in -> N241003).
 */
export function extractStudentIdFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const username = email.split('@')[0];
  const match = username.match(/^([A-Za-z]\d{6})/);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}
