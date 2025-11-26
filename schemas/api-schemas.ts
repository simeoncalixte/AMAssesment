// API Schema definitions for Swagger documentation

export const swaggerDefinitions = {
  Event: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      description: { type: 'string' },
      date: { type: 'string', format: 'date-time' },
      userId: { type: 'number' }
    }
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      events: { 
        type: 'array',
        items: { type: 'number' }
      }
    }
  }
};

// Using function to return schema objects to ensure they're properly evaluated
export function getUsersSchema() {
  return {
    tags: ['Users'],
    summary: 'Get all users',
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            userName: { type: 'string' },
            email: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  };
}

export function addEventSchema() {
  return {
    tags: ['Events'],
    summary: 'Add a new event',
    body: {
      type: 'object',
      required: ['name', 'description', 'date', 'userId'],
      properties: {
        name: { type: 'string', description: 'Event name' },
        description: { type: 'string', description: 'Event description' },
        date: { type: 'string', format: 'date-time', description: 'Event date' },
        userId: { type: 'number', description: 'User ID who created the event' }
      }
    },
    response: {
      200: {
        description: 'Event created successfully',
        type: 'object',
        properties: {
          success: { type: 'boolean' }
        }
      }
    }
  };
}

export function getEventsSchema() {
  return {
    tags: ['Events'],
    summary: 'Get all events',
    response: {
      200: {
        description: 'List of all events',
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            userId: { type: 'number' },
            details: { type: 'string' }
          }
        }
      }
    }
  };
}

export function getEventsByUserIdSchema() {
  return {
    tags: ['Events', 'Users'],
    summary: 'Get events by user ID',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { 
          type: 'string',
          description: 'User ID'
        }
      }
    },
    response: {
      200: {
        description: 'User events',
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            userId: { type: 'number' },
            details: { type: 'string' }
          }
        }
      }
    }
  };
}