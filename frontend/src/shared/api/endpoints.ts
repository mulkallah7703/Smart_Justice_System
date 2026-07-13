export const endpoints = {
  auth: {
    nafathVerify: '/auth/nafath/verify',
  },
  alerts: {
    list: '/alerts',
    markRead: (id: string) => `/alerts/${id}/read`,
  },
  guide: {
    start: '/ai/guide/start',
    answer: '/ai/guide/answer',
    summary: (sessionId: string) => `/ai/guide/summary/${sessionId}`,
  },
  advisor: {
    upload: '/documents/upload',
    analyze: '/ai/advisor/analyze',
    report: (jobId: string) => `/ai/advisor/report/${jobId}`,
    reportPdf: (jobId: string) => `/ai/advisor/report/${jobId}?format=pdf`,
    opinion: (jobId: string) => `/ai/advisor/opinion/${jobId}`,
  },
  lawyers: {
    list: '/lawyers',
    detail: (id: string) => `/lawyers/${id}`,
    availability: (id: string) => `/lawyers/${id}/availability`,
  },
  booking: {
    create: '/consultations/book',
  },
  payments: {
    summary: (consultationId: string) =>
      `/payments/summary/${consultationId}`,
    initiate: '/payments/initiate',
    detail: (id: string) => `/payments/${id}`,
  },
  judicialCard: {
    detail: '/judicial-card',
    qr: '/judicial-card/qr',
    upgrade: '/judicial-card/upgrade',
  },
  legalFile: {
    cases: '/cases',
    appointments: '/cases?type=hearing',
    documents: '/documents',
    notifications: '/alerts?all=true',
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
