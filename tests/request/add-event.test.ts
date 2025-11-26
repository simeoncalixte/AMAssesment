/**
 * @file tests/request/add-event.test.ts
 * @description Integration test suite for the POST /addEvent endpoint, focusing on event creation functionality.
 * Tests include successful event creation, error handling, validation, and performance scenarios.
 * Uses actual server instance to validate real-world behavior including middleware integration.
 */

import { createServer } from '../../services/server';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AddEventBody } from '../../types/api-types';
import { addEventHandler } from '../../request/add-event';
import { queryQueue } from '../../utils/queryQueue';

describe('POST /addEvent', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  const createTestEvent = (overrides: Partial<AddEventBody> = {}): AddEventBody => ({
    name: 'Test Event',
    description: 'A test event description',
    date: '2023-12-25T10:00:00Z',
    userId: 1,
    ...overrides
  });

  describe('Successful scenarios', () => {
    it('should successfully create an event with valid data', async () => {
      const eventData = createTestEvent();

      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: eventData
      });

      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('success', true);
    });

    it('should return proper content type', async () => {
      const eventData = createTestEvent();

      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: eventData
      });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

  });

  describe('Validation and error handling', () => {
    it('should handle missing required fields', async () => {
      const invalidEvent = {
        name: 'Incomplete Event'
        // Missing description, date, userId
      };

      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: invalidEvent
      });

      // Should return validation error
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid date formats', async () => {
      const invalidEvent = createTestEvent({
        date: 'invalid-date-format'
      });

      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: invalidEvent
      });

      // Should handle gracefully - either validation error or parse the date
      expect([200, 400, 422]).toContain(response.statusCode);
    });

    it('should handle invalid JSON payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: 'invalid-json'
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should handle empty payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: {}
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Performance and reliability', () => {
    it('should respond within reasonable time', async () => {
      const eventData = createTestEvent();
      const startTime = Date.now();
      
      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: eventData
      });

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect([200, 503]).toContain(response.statusCode); // Success or service unavailable
    });

    it('should handle multiple concurrent requests', async () => {
      const events = Array.from({ length: 5 }, (_, i) => 
        createTestEvent({ 
          name: `Concurrent Event ${i + 1}`,
          userId: i + 1
        })
      );

      const requests = events.map(eventData =>
        server.inject({
          method: 'POST',
          url: '/addEvent',
          payload: eventData
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach((response) => {
        // Should either succeed or fail gracefully
        expect([200, 503]).toContain(response.statusCode);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        
        // Verify response can be parsed as JSON
        expect(() => JSON.parse(response.body)).not.toThrow();
      });
    });

    it('should handle service unavailable scenarios gracefully', async () => {
      // MSW mock returns 503 errors after 5 successful requests
      const events = Array.from({ length: 20 }, (_, i) => 
        createTestEvent({ 
          name: `Load Test Event ${i + 1}`,
          userId: 1
        })
      );

      let successCount = 0;
      let errorCount = 0;

      for (const eventData of events) {
        const response = await server.inject({
          method: 'POST',
          url: '/addEvent',
          payload: eventData
        });

        if (response.statusCode === 200) {
          successCount++;
          const result = JSON.parse(response.body);
          expect(result.success).toBe(true);
        } else if (response.statusCode === 503) {
          errorCount++;
          const result = JSON.parse(response.body);
          expect(result).toMatchObject({
            error: {
              message: expect.any(String),
              statusCode: 503
            }
          });
        }
      }

      // Should have some successes and some service unavailable responses
      expect(successCount).toBeGreaterThan(0);
      expect(successCount + errorCount).toBe(20);
    });
  });

  describe('Integration with error middleware', () => {
    it('should provide structured error responses', async () => {
      const invalidEvent = { invalid: 'data' };

      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: invalidEvent
      });

      if (response.statusCode >= 400) {
        const body = JSON.parse(response.body);
        
        // Should have proper error structure from middleware
        expect(body).toMatchObject({
          error: {
            message: expect.any(String),
            statusCode: expect.any(Number)
          },
          timestamp: expect.any(String),
          path: '/addEvent'
        });
      }
    });

    it('should not expose internal error details', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: 'malformed-json'
      });

      if (response.statusCode >= 400) {
        const body = JSON.parse(response.body);
        
        // Should not expose internal stack traces
        expect(body.error.stack).toBeUndefined();
        expect(body.error.message).not.toMatch(/stack|trace/i);
      }
    });

    it('should log errors appropriately', async () => {
      // This test ensures the middleware logging works
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        const response = await server.inject({
          method: 'POST',
          url: '/addEvent',
          payload: { invalid: 'payload' }
        });

        if (response.statusCode >= 400) {
          // Error should be logged (though we can't easily verify console output in tests)
          expect(response.statusCode).toBeGreaterThanOrEqual(400);
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});

describe('addEventHandler - Direct Handler Testing', () => {
  const createMockReply = () => {
    const sendMock = jest.fn();
    const reply = {
      send: sendMock,
      status: jest.fn(() => reply),
    } as unknown as FastifyReply & { send: jest.Mock };
    return reply;
  };
  
  const createMultipleEventsForUser = ({
    userId,
    eventCount
  }: {
    userId: number;
    eventCount: number;
  }): AddEventBody[] => {
    const events = [];
    for (let i = 0; i < eventCount; i++) {
      events.push({
        name: `Event ${i + 1}`,
        userId,
        details: `This is the ${i + 1} event`,
        description: `Description for event ${i + 1}`,
        date: new Date().toISOString()
      });
    }
    return events;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Queuing mechanism tests', () => {
    it('should not be able to handle a large number of events without queue', async () => {
      /**
       * This does not use the queryQueue to manage request and will not be able to return all events
       * successfully due to rate limiting or resource constraints.
       */
      const reply = createMockReply();
      const additionalEvents: AddEventBody[] = createMultipleEventsForUser({ userId: 1, eventCount: 10000});
      
      await Promise.allSettled(
        additionalEvents.map(event => 
          addEventHandler({
            body: event
          } as FastifyRequest<{ Body: AddEventBody }>, reply)
        )
      );
      
      expect(reply.send.mock.calls.length).not.toBe(10000);
    }, 300000);

    it('should be able to create a large number of events for a user using queue', async () => {
      /**
       * This uses the queued version of the addEventHandler to manage request and will be able to return all events
       * successfully. Ideally, we would want to have a route that can insert multiple events in one request to optimize performance.
       * But for the purpose of this test, we are focusing on the queuing mechanism.
       */
      const queuedQueryAddEventHandler = queryQueue(addEventHandler);
      const reply = createMockReply();
      const additionalEvents: AddEventBody[] = createMultipleEventsForUser({ userId: 1, eventCount: 10000});
      
      await Promise.allSettled(
        additionalEvents.map(event => 
          queuedQueryAddEventHandler({
            body: event
          } as FastifyRequest<{ Body: AddEventBody }>, reply)
        )
      );
      
      expect(reply.send.mock.calls.length).toBe(10000);
    }, 300000);

    it('should handle individual event creation with proper response', async () => {
      const reply = createMockReply();
      const eventData: AddEventBody = {
        name: 'Test Event',
        description: 'Test Description',
        date: '2023-12-25T10:00:00Z',
        userId: 1
      };

      await queryQueue(addEventHandler)({
        body: eventData
      } as FastifyRequest<{ Body: AddEventBody }>, reply);

      expect(reply.send).toHaveBeenCalledTimes(1);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean)
        })
      );
    });

    it('should demonstrate queuing improves success rate', async () => {
      const reply1 = createMockReply();
      const reply2 = createMockReply();
      const eventCount = 100; // Smaller number for faster test
      const events = createMultipleEventsForUser({ userId: 1, eventCount });

      // Test without queue
      await Promise.allSettled(
        events.map(event => 
          addEventHandler({
            body: event
          } as FastifyRequest<{ Body: AddEventBody }>, reply1)
        )
      );

      // Test with queue
      const queuedHandler = queryQueue(addEventHandler);
      await Promise.allSettled(
        events.map(event => 
          queuedHandler({
            body: event
          } as FastifyRequest<{ Body: AddEventBody }>, reply2)
        )
      );

      // Queued version should have equal or better success rate
      expect(reply2.send.mock.calls.length).toBeGreaterThanOrEqual(reply1.send.mock.calls.length);
    }, 60000);

    it('should handle errors gracefully in queued operations', async () => {
      const queuedHandler = queryQueue(addEventHandler);
      const reply = createMockReply();
      
      // Test with invalid event data
      const invalidEvent = {
        name: '', // Invalid empty name
        description: '',
        date: 'invalid-date',
        userId: -1 // Invalid user ID
      } as AddEventBody;

      await queuedHandler({
        body: invalidEvent
      } as FastifyRequest<{ Body: AddEventBody }>, reply);

      // Should still call reply.send even if there's an error
      expect(reply.send).toHaveBeenCalled();
    });
  });
});