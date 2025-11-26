/**
 * @file tests/services/api-middleware.test.ts
 * @description Tests for the error handling middleware
 */

import { createServer } from '../../services/server';
import { FastifyInstance } from 'fastify';
import { ApiError } from '../../services/api-middleware';

describe('Error Handling Middleware', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('404 Not Found Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/non-existent-route'
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Route GET /non-existent-route not found',
          code: 'ROUTE_NOT_FOUND',
          statusCode: 404
        },
        timestamp: expect.any(String),
        path: '/non-existent-route'
      });
    });
  });

  describe('Validation Error Handler', () => {
    it('should return 400 for invalid request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: {
          invalidField: 'invalid'
        }
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.statusCode).toBe(400);
      expect(body.error.details).toBeDefined();
    });
  });

  describe('Custom Error Handling', () => {
    beforeEach(() => {
      // Add test routes that throw different types of errors
      server.get('/test-error/:type', async (request, reply) => {
        const { type } = request.params as { type: string };
        
        switch (type) {
          case 'api-error':
            throw new ApiError('Custom API error', 422, 'CUSTOM_ERROR', { detail: 'test' });
          case 'generic-error':
            throw new Error('Generic error');
          case 'service-unavailable':
            throw new ApiError('Service unavailable', 503, 'SERVICE_UNAVAILABLE');
          case 'timeout':
            throw new ApiError('Request timeout', 408, 'REQUEST_TIMEOUT');
          default:
            reply.send({ message: 'OK' });
        }
      });
    });

    it('should handle custom ApiError correctly', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-error/api-error'
      });

      expect(response.statusCode).toBe(422);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Custom API error',
          code: 'CUSTOM_ERROR',
          statusCode: 422,
          details: { detail: 'test' }
        },
        timestamp: expect.any(String),
        path: '/test-error/api-error'
      });
    });

    it('should handle generic errors as 500', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-error/generic-error'
      });

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Generic error',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: '/test-error/generic-error'
      });
    });

    it('should handle service unavailable errors', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-error/service-unavailable'
      });

      expect(response.statusCode).toBe(503);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Service unavailable',
          code: 'SERVICE_UNAVAILABLE',
          statusCode: 503
        },
        timestamp: expect.any(String),
        path: '/test-error/service-unavailable'
      });
    });

    it('should handle timeout errors', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-error/timeout'
      });

      expect(response.statusCode).toBe(408);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          statusCode: 408
        },
        timestamp: expect.any(String),
        path: '/test-error/timeout'
      });
    });
  });
});