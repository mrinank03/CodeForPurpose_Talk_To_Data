export interface Schedule {
  schedule_id: string;
  notebook_id: string;
  cron_expression: string;
  recipient_emails: string;
  timezone: string;
  enabled: boolean;
}

export interface ScheduleCreate {
  notebook_id: string;
  cron_expression: string;
  recipient_emails: string;
  timezone?: string;
}

export interface ScheduleUpdate {
  cron_expression?: string;
  recipient_emails?: string;
  timezone?: string;
  enabled?: boolean;
}
