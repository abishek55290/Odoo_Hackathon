/**
 * Standardised API response helpers.
 * Used by ALL members — import from '@/lib/response'.
 *
 * Every endpoint returns one of these two shapes:
 *   { success: true,  data: T }
 *   { success: false, error: string, code: string }
 */

import { Response } from 'express';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data } satisfies SuccessResponse<T>);
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  code = 'ERROR',
): Response {
  return res.status(status).json({ success: false, error: message, code } satisfies ErrorResponse);
}
