export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NotificationDelivery {
  id: string;
  channel: 'IN_APP' | 'EMAIL';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  attempt_count: number;
  last_attempt_at: string;
  error_message?: string;
  recipient_destination?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  source_pillar: string;
  source_display_name?: string;
  event_type?: string;
  event_id?: string;
  title: string;
  message: string;
  type: string;
  priority: NotificationPriority;
  action_route?: string;
  action_required: boolean;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  read_at?: string;
  expires_at?: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deliveries?: NotificationDelivery[];
}

export interface NotificationListResponse {
  count: number;
  unread_count: number;
  action_required_count: number;
  notifications: NotificationItem[];
}

export interface NotificationSummary {
  total_count: number;
  unread_count: number;
  action_required_count: number;
  by_pillar: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface NotificationPreferenceItem {
  id: string;
  user_id: string;
  source_pillar: string;
  event_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PillarMetadata {
  pillar_id: string;
  display_name: string;
  description: string;
  supported_events: string[];
  channels: string[];
}
