// TypeScript interfaces for API types

export interface User {
  id: number;
  name: string;
  email: string;
  events: number[];
}

export interface Event {
      id: number;
      name: string;
      userId: number;
      details:string;
}

export interface AddEventBody {
  name: string;
  description: string;
  date: string;
  userId: number;
}

export interface GetEventsByUserIdParams {
  id: string;
}