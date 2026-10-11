import type { StatusBadgeVariant } from '../../shared/components/StatusBadge';

export type CaseStatusVariant = StatusBadgeVariant;

export interface HomeUser {
  name: string;
  greeting: string;
}

export interface HomeJudicialCard {
  cardNumber: string;
  tier: 'normal' | 'silver' | 'gold';
  tierLabel: string;
  discountPct: number;
}

export interface HomeAlert {
  id: string;
  title: string;
  subtitle: string;
}

export interface HomeCase {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
  statusVariant: CaseStatusVariant;
  icon: string;
}

export interface HomeService {
  title: string;
  description: string;
  icon: string;
  iconTone: 'primary' | 'blue' | 'warm' | 'neutral';
  route: string;
}

export interface HomeData {
  user: HomeUser;
  card: HomeJudicialCard;
  alert: HomeAlert | null;
  services: HomeService[];
  cases: HomeCase[];
  isLoading: boolean;
}
