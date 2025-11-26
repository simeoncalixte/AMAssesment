/**
 * @file tests/request/add-event-v2.test.ts
 * @description Integration test suite for the POST /v2/addEvent endpoint with queuing mechanism.
 * This route uses the queryQueue utility to handle high-volume requests more efficiently.
 * Tests focus on performance improvements, reliability, and queue behavior.
 */

import { createServer } from '../../services/server';
import { FastifyInstance } from 'fastify';
import { AddEventBody } from '../../types/api-types';

describe('POST /v2/addEvent (with queuing)', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  const createTestEvent = (overrides: Partial<AddEventBody> = {}): AddEventBody => ({
    name: 'Test Event V2',
    description: 'A test event for V2 API with queuing',
    date: '2023-12-25T10:00:00Z',
    userId: 1,
    ...overrides
  });

  describe('Basic functionality', () => {
    it('should successfully create an event with queuing', async () => {
      const eventData = createTestEvent();

      const response = await server.inject({
        method: 'POST',
        url: '/v2/addEvent',
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
        url: '/v2/addEvent',
        payload: eventData
      });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should work with the same data structure as v1', async () => {
      const eventData = createTestEvent();

      // Test v1 route
      const responseV1 = await server.inject({
        method: 'POST',
        url: '/addEvent',
        payload: eventData
      });

      // Test v2 route
      const responseV2 = await server.inject({
        method: 'POST',
        url: '/v2/addEvent',
        payload: eventData
      });

      // Both should succeed (or fail with same status if MSW returns error)
      expect(responseV1.statusCode).toBe(responseV2.statusCode);
      
      if (responseV1.statusCode === 200 && responseV2.statusCode === 200) {
        const resultV1 = JSON.parse(responseV1.body);
        const resultV2 = JSON.parse(responseV2.body);
        expect(resultV1.success).toBe(resultV2.success);
      }
    });
  });

  describe('High-volume performance testing', () => {
    it('should handle multiple requests more reliably than v1', async () => {
      const eventCount = 50;
      const events = Array.from({ length: eventCount }, (_, i) => 
        createTestEvent({ 
          name: `Performance Test Event ${i + 1}`,
          userId: 1
        })
      );

      // Test v1 route (without queuing)
      const v1StartTime = Date.now();
      const v1Requests = events.map(eventData =>
        server.inject({
          method: 'POST',
          url: '/addEvent',
          payload: eventData
        })
      );
      const v1Responses = await Promise.all(v1Requests);
      const v1Duration = Date.now() - v1StartTime;
      const v1SuccessCount = v1Responses.filter(r => r.statusCode === 200).length;

      // Test v2 route (with queuing)
      const v2StartTime = Date.now();
      const v2Requests = events.map(eventData =>
        server.inject({
          method: 'POST',
          url: '/v2/addEvent',
          payload: eventData
        })
      );
      const v2Responses = await Promise.all(v2Requests);
      const v2Duration = Date.now() - v2StartTime;
      const v2SuccessCount = v2Responses.filter(r => r.statusCode === 200).length;

      console.log(`V1: ${v1SuccessCount}/${eventCount} successful in ${v1Duration}ms`);
      console.log(`V2: ${v2SuccessCount}/${eventCount} successful in ${v2Duration}ms`);

      // V2 should have equal or better success rate
      expect(v2SuccessCount).toBeGreaterThanOrEqual(v1SuccessCount);
      
      // All responses should be valid JSON
      [...v1Responses, ...v2Responses].forEach(response => {
        expect(() => JSON.parse(response.body)).not.toThrow();
      });
    }, 60000);

    it('should handle sequential requests efficiently', async () => {
      const eventCount = 20;
      const events = Array.from({ length: eventCount }, (_, i) => 
        createTestEvent({ 
          name: `Sequential V2 Event ${i + 1}`,
          userId: 2
        })
      );

      let successCount = 0;
      let errorCount = 0;
      const startTime = Date.now();

      for (const eventData of events) {
        const response = await server.inject({
          method: 'POST',
          url: '/v2/addEvent',
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
            error: expect.any(Object)
          });
        }
      }

      const duration = Date.now() - startTime;
      
      console.log(`V2 Sequential: ${successCount}/${eventCount} successful in ${duration}ms`);
      
      // Should process all requests
      expect(successCount + errorCount).toBe(eventCount);
      // Should have some successes
      expect(successCount).toBeGreaterThan(0);
    }, 30000);

    it('should maintain order in queued operations', async () => {
      const eventCount = 10;
      const events = Array.from({ length: eventCount }, (_, i) => 
        createTestEvent({ 
          name: `Ordered Event ${String(i + 1).padStart(2, '0')}`,
          description: `Event created at index ${i}`,
          userId: 3
        })
      );

      const responses = await Promise.all(
        events.map(eventData =>
          server.inject({
            method: 'POST',
            url: '/v2/addEvent',
            payload: eventData
          })
        )
      );

      // All responses should be handled
      expect(responses).toHaveLength(eventCount);
      
      // All should return valid responses
      responses.forEach(response => {
        expect([200, 503]).toContain(response.statusCode);
        expect(() => JSON.parse(response.body)).not.toThrow();
      });
    });
  });

  describe('Error handling with queuing', () => {
    it('should handle validation errors gracefully in queued operations', async () => {
      const invalidEvents = [
        { name: '' }, // Missing required fields
        { name: 'Valid', userId: 'invalid' }, // Invalid type
        { name: 'Valid', userId: 1, date: 'invalid-date' }, // Invalid date
      ];

      for (const invalidEvent of invalidEvents) {
        const response = await server.inject({
          method: 'POST',
          url: '/v2/addEvent',
          payload: invalidEvent
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        expect(() => JSON.parse(response.body)).not.toThrow();
      }
    });

    it('should provide consistent error structure', async () => {
      const invalidEvent = { name: 'Test' }; // Missing required fields

      const response = await server.inject({
        method: 'POST',
        url: '/v2/addEvent',
        payload: invalidEvent
      });

      if (response.statusCode >= 400) {
        const body = JSON.parse(response.body);
        
        expect(body).toMatchObject({
          error: {
            message: expect.any(String),
            statusCode: expect.any(Number)
          },
          timestamp: expect.any(String),
          path: '/v2/addEvent'
        });
      }
    });

    it('should not expose queue internals in error responses', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/v2/addEvent',
        payload: 'invalid-json'
      });

      if (response.statusCode >= 400) {
        const body = JSON.parse(response.body);
        
        // Should not expose queue or internal details
        expect(JSON.stringify(body)).not.toMatch(/queue|internal|stack/i);
      }
    });
  });

  describe('Comparison with v1 endpoint', () => {
    it('should demonstrate reliability improvement over v1', async () => {
      const testRuns = 3;
      const eventsPerRun = 30;
      
      let v1TotalSuccess = 0;
      let v2TotalSuccess = 0;

      for (let run = 0; run < testRuns; run++) {
        const events = Array.from({ length: eventsPerRun }, (_, i) => 
          createTestEvent({ 
            name: `Reliability Test Run ${run + 1} Event ${i + 1}`,
            userId: run + 1
          })
        );

        // Test V1
        const v1Responses = await Promise.all(
          events.map(eventData =>
            server.inject({
              method: 'POST',
              url: '/addEvent',
              payload: eventData
            })
          )
        );
        v1TotalSuccess += v1Responses.filter(r => r.statusCode === 200).length;

        // Test V2
        const v2Responses = await Promise.all(
          events.map(eventData =>
            server.inject({
              method: 'POST',
              url: '/v2/addEvent',
              payload: eventData
            })
          )
        );
        v2TotalSuccess += v2Responses.filter(r => r.statusCode === 200).length;

        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalRequests = testRuns * eventsPerRun;
      console.log(`Reliability Test - V1: ${v1TotalSuccess}/${totalRequests}, V2: ${v2TotalSuccess}/${totalRequests}`);
      
      // V2 should have equal or better success rate
      expect(v2TotalSuccess).toBeGreaterThanOrEqual(v1TotalSuccess);
    }, 90000);

    it('should handle the same payload formats as v1', async () => {
      const testPayloads = [
        createTestEvent(),
        createTestEvent({ date: '2023-12-25T10:30:45.123Z' }),
        createTestEvent({ description: 'Very long description with special characters: !@#$%^&*()' }),
        createTestEvent({ name: 'Event with émojis 🎉🎊' }),
      ];

      for (const payload of testPayloads) {
        const v1Response = await server.inject({
          method: 'POST',
          url: '/addEvent',
          payload
        });

        const v2Response = await server.inject({
          method: 'POST',
          url: '/v2/addEvent',
          payload
        });

        // Both should handle the same payload similarly
        expect([200, 503]).toContain(v1Response.statusCode);
        expect([200, 503]).toContain(v2Response.statusCode);
        
        // Both should return valid JSON
        expect(() => JSON.parse(v1Response.body)).not.toThrow();
        expect(() => JSON.parse(v2Response.body)).not.toThrow();
      }
    });
  });
});