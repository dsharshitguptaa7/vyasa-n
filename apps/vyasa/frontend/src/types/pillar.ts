export type PillarStatus = 'active' | 'maintenance' | 'beta' | 'disabled';

export interface PillarMetadata {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  route: string;
  status: PillarStatus;
  enabled: boolean;
  requiredRoles: string[];
  version?: string;
  endpointUrl?: string;
}

export interface PillarListResponse {
  count: number;
  pillars: PillarMetadata[];
}
