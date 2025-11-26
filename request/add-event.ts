import { FastifyRequest, FastifyReply } from 'fastify';
import { AddEventBody } from '../types/api-types';
import { createBadRequestError, createInternalServerError, createServiceUnavailableError } from '../services/api-middleware';


/**
 * Handler for POST /addEvent route
 * Creates a new event via the external API
 */
export const addEventHandler = async (
  request: FastifyRequest<{ Body: AddEventBody }>, 
  reply: FastifyReply
): Promise<void> => {
  try {
    const resp: Response = await fetch('http://event.com/addEvent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: new Date().getTime(),
        ...request.body
      })
    });

    // Handle HTTP errors from the external service
    if (!resp.ok) {
      if (resp.status >= 500) {
        throw createServiceUnavailableError('External event service is unavailable');
      } else if (resp.status === 400) {
        throw createBadRequestError('Invalid event data provided');
      } else if (resp.status === 408) {
        throw createInternalServerError('Request to event service timed out');
      } else {
        throw createInternalServerError(`Event service responded with status ${resp.status}`);
      }
    }

    const data = await resp.json() as { success: boolean } & any;
    
    if ("success" in data) {
      const { success } = data;
      if (!success) {
        // Business logic failure - the service responded but couldn't create the event
        const errorMessage = data.message || data.error || 'Failed to create event';
        throw createBadRequestError(errorMessage, data);
      } else {
        reply.send(data);
        return data;
      }
    } else {
      // Invalid response format
      throw createInternalServerError('Invalid response format from event service');
    }
  } catch (error) {
    // Re-throw our custom errors, wrap network/parsing errors
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    
    // Handle fetch network errors
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        throw createServiceUnavailableError('Unable to connect to event service');
      }
      throw createInternalServerError(`Event creation failed: ${error.message}`);
    }
    
    throw createInternalServerError('Unknown error occurred while creating event');
  }
};