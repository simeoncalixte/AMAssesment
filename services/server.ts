/**
 * 
 * @file services/server.ts
 * @description This file sets up and configures the Fastify server, including route definitions and Swagger documentation.
 * It exports a function to create the server instance, which can be used in other parts of the application.
 * For modularity and testabilitym the request handlers are imported from the request directory and schemas from the schemas directory.
 * All request handlers must be created and exported from the request/index.ts file.
 */

import fastify, { FastifyInstance } from 'fastify';
import { swaggerDefinitions, getUsersSchema, addEventSchema, getEventsSchema, getEventsByUserIdSchema } from '../schemas/api-schemas';
import { AddEventBody, GetEventsByUserIdParams } from '../types/api-types';
import { 
  getUsersHandler, 
  getEventsHandler, 
  addEventHandler, 
  getEventsByUserIdHandler 
} from '../request';
import { queryQueue } from '../utils/queryQueue';
import { registerErrorHandlers } from './api-middleware';
import listenMock from '../mock-server';

export const createServer = async (): Promise<FastifyInstance> => {
  const server = fastify({ logger: false }); // Set logger to false for testing
  listenMock();
  try {
    // Register error handlers first
    await registerErrorHandlers(server);
    // Register Swagger
    await server.register(require('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'Events API',
          description: 'API for managing events and users',
          version: '1.0.0'
        },
        host: 'localhost:3000',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        definitions: swaggerDefinitions,
      }
    });
    // Register routes
    server.get('/getUsers', {
      schema: getUsersSchema()
    }, getUsersHandler);

    server.post<{ Body: AddEventBody }>('/addEvent', {
      schema: addEventSchema()
    }, addEventHandler);

    // V2 route with queuing mechanism
    const queuedAddEventHandler = queryQueue(addEventHandler);
    server.post<{ Body: AddEventBody }>('/v2/addEvent', {
      schema: addEventSchema()
    }, queuedAddEventHandler);

    server.get('/getEvents', {
      schema: getEventsSchema()
    }, getEventsHandler);

    server.get<{ Params: GetEventsByUserIdParams }>('/getEventsByUserId/:id', {
      schema: getEventsByUserIdSchema()
    }, getEventsByUserIdHandler);

    // Register Swagger UI after routes
    await server.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      staticCSP: true,
      transformSpecificationClone: true
    });
    return server;
  } catch (err) {
    server.log.error(err);
    throw err;
  }
};