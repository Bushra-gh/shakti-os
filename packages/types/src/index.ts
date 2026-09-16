export interface Event {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  location?: string;
  confidence?: number;
  payload: Record<string, unknown>;
}
