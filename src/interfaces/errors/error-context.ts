export type ErrorContext = {
  scope: string;
  action?: string;
  metadata?: Record<string, unknown>;
};
