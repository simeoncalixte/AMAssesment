import { createServer } from '../../services/server';
import { FastifyInstance } from 'fastify';

describe('GET /getUsers', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Successful scenarios', () => {
    it('should fetch and return all users successfully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      expect(response.statusCode).toBe(200);
      
      const users = JSON.parse(response.body);
      expect(Array.isArray(users)).toBe(true);
      
      // Verify user structure - MSW mock data structure uses 'userName' not 'name'
      if (users.length > 0) {
        const firstUser = users[0];
        expect(firstUser).toHaveProperty('id');
        expect(firstUser).toHaveProperty('userName');
        expect(firstUser).toHaveProperty('email');
        expect(firstUser).toHaveProperty('events');
        expect(typeof firstUser.id).toBe('number');
        expect(typeof firstUser.userName).toBe('string');
        expect(typeof firstUser.email).toBe('string');
        expect(Array.isArray(firstUser.events)).toBe(true);
      }
    });

    it('should return proper content type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return users with consistent structure', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      expect(response.statusCode).toBe(200);
      
      const users = JSON.parse(response.body);
      expect(Array.isArray(users)).toBe(true);
      
      // All users should have the same structure - MSW uses 'userName' not 'name'
      users.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('userName');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('events');
        expect(typeof user.id).toBe('number');
        expect(typeof user.userName).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(Array.isArray(user.events)).toBe(true);
      });
    });

    it('should return users with valid email formats', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      expect(response.statusCode).toBe(200);
      
      const users = JSON.parse(response.body);
      
      users.forEach((user: any) => {
        // Basic email format validation
        expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });
  });

  describe('Performance and reliability', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect(response.statusCode).toBe(200);
    });


    it('should return consistent data across multiple requests', async () => {
      const response1 = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      const response2 = await server.inject({
        method: 'GET',
        url: '/getUsers'
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      
      const users1 = JSON.parse(response1.body);
      const users2 = JSON.parse(response2.body);
      
      // Users should be consistent across requests
      expect(users1).toEqual(users2);
    });
  });

  describe('Integration with error middleware', () => {
    it('should handle potential service errors gracefully', async () => {
      // Test multiple times to potentially hit MSW's random error condition
      const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
          server.inject({
            method: 'GET',
            url: '/getUsers'
          })
        )
      );

      responses.forEach((response) => {
        // Should either succeed or fail gracefully with structured error
        if (response.statusCode === 200) {
          const users = JSON.parse(response.body);
          expect(Array.isArray(users)).toBe(true);
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
            path: '/getUsers'
          });
        }
      });
    });

    it('should not expose internal error details', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/getUsers'
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
          url: '/getUsers'
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
          path: '/getUsers'
        });
      }
    });
  });
});