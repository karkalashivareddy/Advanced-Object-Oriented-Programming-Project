/** Wire contracts mirrored from project/docs/architecture/API_CONTRACTS.md. */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  correlationId: string;
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
    correlationId: string;
  };
  timestamp: string;
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;
