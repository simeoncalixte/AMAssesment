/**
 * @file services/api-middleware.ts
 * @description Error handling middleware for Fastify server
 * Provides centralized error handling with proper HTTP status codes and response formatting
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
  timestamp: string;
  path: string;
}

export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Creates a standardized error response
 */
const createErrorResponse = (
  error: Error | FastifyError | ApiError,
  request: FastifyRequest
): ErrorResponse => {
  const statusCode = (error as any).statusCode || 500;
  const code = (error as any).code;
  const details = (error as any).details;

  return {
    error: {
      message: error.message || 'Internal Server Error',
      code,
      statusCode,
      details
    },
    timestamp: new Date().toISOString(),
    path: request.url
  };
};

/**
 * Global error handler for Fastify
 */
export const errorHandler = (
  error: Error | FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const errorResponse = createErrorResponse(error, request);
  const { statusCode } = errorResponse.error;

  // Log error details
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      params: request.params,
      query: request.query,
      body: request.body
    });
  } else if (statusCode >= 400) {
    logger.warn('Client Error:', {
      error: error.message,
      url: request.url,
      method: request.method,
      statusCode
    });
  }

  // Send error response
  reply.status(statusCode).send(errorResponse);
};

/**
 * Not Found handler for unmatched routes
 */
export const notFoundHandler = (request: FastifyRequest, reply: FastifyReply) => {
  const errorResponse: ErrorResponse = {
    error: {
      message: `Route ${request.method} ${request.url} not found`,
      code: 'ROUTE_NOT_FOUND',
      statusCode: 404
    },
    timestamp: new Date().toISOString(),
    path: request.url
  };

  logger.warn('Route not found:', {
    url: request.url,
    method: request.method
  });

  reply.status(404).send(errorResponse);
};

/**
 * Validation error handler for schema validation failures
 */
export const validationErrorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if (error.validation) {
    const errorResponse: ErrorResponse = {
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: error.validation
      },
      timestamp: new Date().toISOString(),
      path: request.url
    };

    logger.warn('Validation error:', {
      url: request.url,
      method: request.method,
      validation: error.validation
    });

    reply.status(400).send(errorResponse);
    return;
  }

  // Fall back to general error handler
  errorHandler(error, request, reply);
};

/**
 * Register error handling middleware with Fastify instance
 */
export const registerErrorHandlers = async (server: FastifyInstance) => {
  // Set global error handler
  server.setErrorHandler(validationErrorHandler);
  
  // Set not found handler
  server.setNotFoundHandler(notFoundHandler);

  // Add hook for async errors
  server.addHook('onError', async (request, _reply, error) => {
    // Additional error processing if needed
    if (error.statusCode === 500) {
      logger.error('Unhandled server error:', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method
      });
    }
  });
};

// Export convenience functions for creating common errors
export const createNotFoundError = (resource: string) => 
  new ApiError(`${resource} not found`, 404, 'NOT_FOUND');

export const createBadRequestError = (message: string, details?: any) => 
  new ApiError(message, 400, 'BAD_REQUEST', details);

export const createUnauthorizedError = (message: string = 'Unauthorized') => 
  new ApiError(message, 401, 'UNAUTHORIZED');

export const createForbiddenError = (message: string = 'Forbidden') => 
  new ApiError(message, 403, 'FORBIDDEN');

export const createInternalServerError = (message: string = 'Internal Server Error') => 
  new ApiError(message, 500, 'INTERNAL_SERVER_ERROR');

export const createConflictError = (message: string, details?: any) => 
  new ApiError(message, 409, 'CONFLICT', details);

export const createServiceUnavailableError = (message: string = 'Service Unavailable') => 
  new ApiError(message, 503, 'SERVICE_UNAVAILABLE');

export const createTimeoutError = (message: string = 'Request Timeout') => 
  new ApiError(message, 408, 'REQUEST_TIMEOUT');