import { FastifyRequest, FastifyReply } from 'fastify';
import { Event } from '../types/api-types';
import { createInternalServerError, createServiceUnavailableError } from '../services/api-middleware';

/**
 * Handler for GET /getEvents route
 * Fetches all events from the external API
 */
export const getEventsHandler = async (
  _request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> => {
  try {
    const resp = await fetch('http://event.com/getEvents');
    
    if (!resp.ok) {
      if (resp.status >= 500) {
        throw createServiceUnavailableError('Events service is unavailable');
      } else {
        throw createInternalServerError(`Events service responded with status ${resp.status}`);
      }
    }
    
    const data = await resp.json() as Event[];
    reply.send(data);
  } catch (error) {
    // Re-throw our custom errors, wrap others
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    
    // Handle fetch network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      throw createServiceUnavailableError('Unable to connect to events service');
    }
    
    throw createInternalServerError('Failed to fetch events');
  }
};