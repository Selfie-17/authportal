/**
 * Standard performance Service Level Objectives (SLOs) and pass/fail thresholds
 * as defined in the technical specification:
 * - HTTP error rate below 1% (http_req_failed < 0.01)
 * - P95 response time below 2000ms for normal API operations
 * - P99 response time below 4000ms
 */

export const standardThresholds = {
  // Global request failure rate must be under 1%
  http_req_failed: ['rate<0.01'],
  // 95% of requests must complete under 2.0s, 90% under 1.0s
  http_req_duration: ['p(90)<1000', 'p(95)<2000', 'p(99)<4000'],
};

export const baselineThresholds = {
  http_req_failed: ['rate<0.005'],
  http_req_duration: ['p(90)<300', 'p(95)<500', 'p(99)<1000'],
};

export const fileDownloadThresholds = {
  http_req_failed: ['rate<0.02'],
  // Larger files and streaming ZIP transfers allow higher duration threshold
  http_req_duration: ['p(90)<3000', 'p(95)<5000'],
};

export const spikeThresholds = {
  // During high spike, allow up to 5% failures before declaring system crashed
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(90)<3000', 'p(95)<6000'],
};
