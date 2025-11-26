import { FastifyRequest, FastifyReply } from 'fastify';
import { User, Event, GetEventsByUserIdParams } from '../types/api-types';
import { createNotFoundError, createInternalServerError } from '../services/api-middleware';

/**
 * Handler for GET /getEventsByUserId/:id route
 * Fetches all events for a specific user
 */
export const getEventsByUserIdHandler = async (
  request: FastifyRequest<{ Params: GetEventsByUserIdParams }>, 
  reply: FastifyReply
): Promise<void> => {
  const { id } = request.params;
  
  // Validate user ID
  if (!id || isNaN(Number(id))) {
    throw createNotFoundError('User');
  }
  
  try {
    // Fetch user data
    const userResp = await fetch('http://event.com/getUserById/' + id);
    
    if (!userResp.ok) {
      if (userResp.status === 404) {
        throw createNotFoundError('User');
      }
      throw createInternalServerError('Failed to fetch user data');
    }
    
    const userData = await userResp.json() as User;
    const userEvents: number[] = userData.events;
    
    // Fetch each event for the user
    const eventArray: Event[] = [];
    const failedEvents: number[] = [];
    
    for (let i = 0; i < userEvents.length; i++) {
      const eventId = userEvents[i];
      try {
        const eventResp = await fetch('http://event.com/getEventById/' + eventId);
        if (!eventResp.ok) {
          if (eventResp.status === 404) {
            failedEvents.push(eventId);
            continue; // Event doesn't exist, but continue with others
          }
        }
        const eventData = await eventResp.json() as Event;
        eventArray.push(eventData);
      } catch (fetchError) {
        // Network or parsing errors should fail the entire request
        throw createInternalServerError(`Failed to fetch event ${eventId}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }
    }
    
    // For backward compatibility, return just the array if all events were fetched successfully
    // Include warnings only if there were missing events
    if (failedEvents.length === 0) {
      reply.send(eventArray);
    } else {
      const response = {
        events: eventArray,
        warnings: {
          missingEvents: failedEvents,
          message: `${failedEvents.length} event(s) could not be found`
        }
      };
      reply.send(response);
    }
  } catch (error) {
    // Re-throw our custom errors, wrap others
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createInternalServerError('Failed to fetch user events');
  }
};