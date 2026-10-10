export type DependencyStatus = 'up' | 'down' | 'skipped';

export interface HealthStatus {
  status: 'ok';
}

export interface ReadinessChecks {
  postgres: DependencyStatus;
  redis: DependencyStatus;
  objectStorage: DependencyStatus;
  qdrant: DependencyStatus;
  /** AI modes configured for this process — never includes secrets. */
  aiConfig: DependencyStatus;
}

export interface ReadinessStatus {
  status: 'ok' | 'error';
  checks: ReadinessChecks;
}
