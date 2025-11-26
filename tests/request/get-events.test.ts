import { createServer } from '../../services/server';
import { FastifyInstance } from 'fastify';

describe('GET /getEvents', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Successful scenarios', () => {
    it('should fetch and return all events successfully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      expect(response.statusCode).toBe(200);
      
      const events = JSON.parse(response.body);
      expect(Array.isArray(events)).toBe(true);
      
      // Verify event structure - MSW mock uses different fields
      if (events.length > 0) {
        const firstEvent = events[0];
        expect(firstEvent).toHaveProperty('id');
        expect(firstEvent).toHaveProperty('name');
        expect(firstEvent).toHaveProperty('details'); // MSW uses 'details' not 'description'
        expect(firstEvent).toHaveProperty('userId');
        expect(typeof firstEvent.id).toBe('number');
        expect(typeof firstEvent.name).toBe('string');
        expect(typeof firstEvent.details).toBe('string');
        expect(typeof firstEvent.userId).toBe('number');
      }
    });

    it('should return proper content type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return events with consistent structure', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      expect(response.statusCode).toBe(200);
      
      const events = JSON.parse(response.body);
      expect(Array.isArray(events)).toBe(true);
      
      // All events should have the same structure
      events.forEach((event: any) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('details');
        expect(event).toHaveProperty('userId');
        expect(typeof event.id).toBe('number');
        expect(typeof event.name).toBe('string');
        expect(typeof event.details).toBe('string');
        expect(typeof event.userId).toBe('number');
      });
    });
  });

  describe('Performance and reliability', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect(response.statusCode).toBe(200);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        server.inject({
          method: 'GET',
          url: '/getEvents'
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        
        // Verify response can be parsed as JSON
        expect(() => JSON.parse(response.body)).not.toThrow();
        
        const events = JSON.parse(response.body);
        expect(Array.isArray(events)).toBe(true);
      });
    });

    it('should return consistent data across multiple requests', async () => {
      const response1 = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      const response2 = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      
      const events1 = JSON.parse(response1.body);
      const events2 = JSON.parse(response2.body);
      
      // Events should be consistent across requests
      expect(events1).toEqual(events2);
    });
  });

  describe('Integration with error middleware', () => {
    it('should handle potential service errors gracefully', async () => {
      // Test multiple times to potentially hit MSW's random error condition
      const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
          server.inject({
            method: 'GET',
            url: '/getEvents'
          })
        )
      );

      responses.forEach((response) => {
        // Should either succeed or fail gracefully with structured error
        if (response.statusCode === 200) {
          const events = JSON.parse(response.body);
          expect(Array.isArray(events)).toBe(true);
        } else {
          // If MSW returns an error, middleware should handle it properly
          expect(response.statusCode).toBeGreaterThanOrEqual(400);
          
          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            error: {
              message: expect.any(String),
              statusCode: expect.any(Number)
            },
            timestamp: expect.any(String),
            path: '/getEvents'
          });
        }
      });
    });

    it('should not expose internal error details', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getEvents'
      });

      if (response.statusCode >= 400) {
        const body = JSON.parse(response.body);
        
        // Should not expose internal stack traces or sensitive info
        expect(body.error.stack).toBeUndefined();
        expect(body.error.message).not.toMatch(/stack|trace/i);
      }
    });

    it('should include proper error structure when errors occur', async () => {
      // Run multiple requests to potentially trigger MSW error condition
      let errorResponse = null;
      
      for (let i = 0; i < 10; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/getEvents'
        });
        
        if (response.statusCode >= 400) {
          errorResponse = response;
          break;
        }
      }

      if (errorResponse) {
        const body = JSON.parse(errorResponse.body);
        
        // Verify error response structure matches our middleware format
        expect(body).toMatchObject({
          error: {
            message: expect.any(String),
            statusCode: expect.any(Number),
            code: expect.any(String)
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          path: '/getEvents'
        });
      }
    });
  });
});