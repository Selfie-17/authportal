import { Trend } from 'k6/metrics';

/**
 * Diagnostic Trend metrics measuring response duration for each individual endpoint
 * in the Student User Flow.
 * Configured with isTime=true so k6 renders them with time units (ms/s) and computes
 * avg, min, med, max, p(90), and p(95) breakdowns.
 */
export const durationStudentLogin = new Trend('duration_student_login', true);
export const durationMetadata = new Trend('duration_metadata', true);
export const durationSubmissions = new Trend('duration_submissions', true);
export const durationProfile = new Trend('duration_profile', true);
export const durationRoleVerify = new Trend('duration_role_verify', true);
