export const endpoints = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    /** FUTURE Nafath — retained; not used by Login/Register UI. */
    nafathVerify: '/auth/nafath/verify',
  },
  alerts: {
    list: '/alerts',
    markRead: (id: string) => `/alerts/${id}/read`,
  },
  guide: {
    start: '/ai/guide/start',
    answer: '/ai/guide/answer',
    summary: (sessionId: string) =>
      `/ai/guide/summary/${encodeURIComponent(sessionId)}`,
  },
  advisor: {
    analyze: '/ai/advisor/analyze',
    jobs: (jobId: string) => `/ai/advisor/jobs/${encodeURIComponent(jobId)}`,
    retrieve: '/ai/advisor/retrieve',
    answer: '/ai/advisor/answer',
  },
  lawyers: {
    list: '/lawyers',
    detail: (id: string) => `/lawyers/${encodeURIComponent(id)}`,
    availability: (id: string) =>
      `/lawyers/${encodeURIComponent(id)}/availability`,
  },
  booking: {
    create: '/consultations',
    list: '/consultations',
    detail: (id: string) => `/consultations/${encodeURIComponent(id)}`,
  },
  payments: {
    summary: (consultationId: string) =>
      `/payments/summary/${encodeURIComponent(consultationId)}`,
    initiate: '/payments/initiate',
    detail: (id: string) => `/payments/${encodeURIComponent(id)}`,
  },
  judicialCard: {
    detail: '/judicial-card',
    qr: '/judicial-card/qr',
    upgrade: '/judicial-card/upgrade',
  },
  legalFile: {
    cases: '/cases',
    case: (id: string) => `/cases/${encodeURIComponent(id)}`,
    appointments: '/cases?type=hearing',
    documents: '/documents',
    notifications: '/alerts?all=true',
  },
  documents: {
    list: '/documents',
    upload: '/documents',
    detail: (id: string) => `/documents/${encodeURIComponent(id)}`,
    download: (id: string) => `/documents/${encodeURIComponent(id)}/download`,
  },
  kiosk: {
    sessionStart: '/kiosk/session/start',
    scan: '/kiosk/scan',
    print: '/kiosk/print',
  },
  profile: {
    me: '/users/me',
  },
} as const;
