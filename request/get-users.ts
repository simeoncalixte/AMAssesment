import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../types/api-types';
import { createInternalServerError, createServiceUnavailableError } from '../services/api-middleware';

/**
 * Handler for GET /getUsers route
 * Fetches all users from the external API
 */
export const getUsersHandler = async (
  _request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> => {
  try {
    const resp = await fetch('http://event.com/getUsers');
    
    if (!resp.ok) {
      if (resp.status >= 500) {
        throw createServiceUnavailableError('Users service is unavailable');
      } else {
        throw createInternalServerError(`Users service responded with status ${resp.status}`);
      }
    }
    
    const data = await resp.json() as User[];
    reply.send(data);
  } catch (error) {
    // Re-throw our custom errors, wrap others
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    
    // Handle fetch network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      throw createServiceUnavailableError('Unable to connect to users service');
    }
    
    throw createInternalServerError('Failed to fetch users');
  }
};