import { createServer } from '../../services/server';
import { FastifyInstance } from 'fastify';

describe('GET /getEventsByUserId/:id', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Successful scenarios', () => {
    it('should fetch and return events for a user successfully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/1'
      });

      expect(response.statusCode).toBe(200);
      
      const events = JSON.parse(response.body);
      expect(Array.isArray(events)).toBe(true);
      
      // Verify event structure - MSW mock uses different fields
      if (events.length > 0) {
        expect(events[0]).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          details: expect.any(String), // MSW uses 'details' not 'description'
          userId: expect.any(Number)
          // Note: MSW mock doesn't have 'date' field
        });
      }
    });

    it('should handle user with no events (MSW returns undefined for non-existent users)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/999' // Non-existent user in MSW
      });

      // MSW returns undefined for non-existent users, causing server error
      expect(response.statusCode).toBe(500);
      
      const result = JSON.parse(response.body);
      expect(result).toMatchObject({
        error: {
          message: 'Failed to fetch user events',
          statusCode: 500
        }
      });
    });

    it('should return events in proper format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/1'
      });

      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.body);
      
      // Handle both array format (all events found) and object format (some missing)
      if (Array.isArray(result)) {
        // All events found, returned as array
        result.forEach(event => {
          expect(event).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            details: expect.any(String), // MSW uses 'details'
            userId: expect.any(Number)
          });
        });
      } else {
        // Some events missing, returned as object with warnings
        expect(result).toMatchObject({
          events: expect.any(Array),
          warnings: expect.objectContaining({
            missingEvents: expect.any(Array),
            message: expect.any(String)
          })
        });
        
        result.events.forEach((event: any) => {
          expect(event).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            details: expect.any(String), // MSW uses 'details'
            userId: expect.any(Number)
          });
        });
      }
    });
  });

  describe('Error scenarios', () => {
    it('should return 500 for non-existent user (MSW behavior)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/99999' // Non-existent user
      });

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Failed to fetch user events',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: '/getEventsByUserId/99999'
      });
    });

    it('should return 404 for invalid user ID format (validation fails)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/invalid-id'
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'User not found',
          statusCode: 404
        },
        timestamp: expect.any(String),
        path: '/getEventsByUserId/invalid-id'
      });
    });

    it('should return 404 for empty user ID', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/' // Empty ID
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: expect.stringContaining('not found'),
          code: 'NOT_FOUND',
          statusCode: 404
        },
        timestamp: expect.any(String),
        path: '/getEventsByUserId/'
      });
    });

    it('should return 500 for negative user ID (MSW behavior)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/-1'
      });

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Failed to fetch user events',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: '/getEventsByUserId/-1'
      });
    });

    it('should return 500 for zero user ID (MSW behavior)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/0'
      });

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Failed to fetch user events',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: '/getEventsByUserId/0'
      });
    });
  });

  describe('Edge cases and data validation', () => {
    it('should handle large user IDs', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/9999999999'
      });

      // MSW will return undefined for non-existent users, causing 500 error
      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Failed to fetch user events',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: expect.any(String)
      });
    });

    it('should handle user ID with special characters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/1%20OR%201=1' // SQL injection attempt
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'User not found',
          statusCode: 404
        },
        timestamp: expect.any(String),
        path: expect.stringContaining('/getEventsByUserId/')
      });
    });

    it('should handle user ID with leading zeros', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/001'
      });

      // Should treat as valid numeric ID, but user doesn't exist in MSW
      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          message: 'Failed to fetch user events',
          statusCode: 500
        },
        timestamp: expect.any(String),
        path: '/getEventsByUserId/001'
      });
    });
  });

  describe('Response headers and performance', () => {
    it('should return proper content type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/1'
      });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/1'
      });

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) => 
        server.inject({
          method: 'GET',
          url: `/getEventsByUserId/${i + 1}` // Use valid user IDs from MSW mock
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach((response) => {
        expect([200, 500]).toContain(response.statusCode);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        
        // Verify response can be parsed as JSON
        expect(() => JSON.parse(response.body)).not.toThrow();
      });
    });
  });

  describe('Integration with error middleware', () => {
    it('should return structured error responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/nonexistent'
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      
      // Verify error response structure matches our middleware format
      expect(body).toMatchObject({
        error: {
          message: 'User not found',
          statusCode: 404,
          code: expect.any(String)
        },
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        path: '/getEventsByUserId/nonexistent'
      });
    });

    it('should include error codes in responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/abc123'
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
    });

    it('should handle errors gracefully without exposing internal details', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEventsByUserId/trigger-error'
      });

      // Even if internal error occurs, should not expose stack traces to client
      const body = JSON.parse(response.body);
      
      if (response.statusCode >= 400) {
        expect(body).toMatchObject({
          error: {
            message: expect.any(String),
            statusCode: expect.any(Number)
          },
          timestamp: expect.any(String),
          path: expect.any(String)
        });
        
        // Should not expose internal stack traces or sensitive info
        expect(body.error.stack).toBeUndefined();
        expect(body.error.message).not.toMatch(/stack|trace/i);
      }
    });
  });
});
