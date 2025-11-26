import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

interface User {
  userName: string;
  id: number;
  email: string;
  events: string[];
}

interface Event {
  id: number;
  name: string;
  userId: number;
  details: string;
}

interface UserStore {
  users: Record<string, User>;
  addUser(user: User): User;
  getUser(id: string): User;
  getUsers(): User[];
  addEventTouUser(userId: number, eventId: string): void;
}

interface EventStore {
  events: Record<string, Event>;
  addEvent(event: Event): Event;
  getEvent(id: string): Event;
  getEvents(): Event[];
}

let requestCount = 0;

const userStore: UserStore = {
  users: {
    "1": {
      userName: 'user1',
      id: 1,
      email: 'hello@gmail.com',
      events: ['event-1', 'event-3']
    },
    "2": {
      userName: 'user2',
      id: 2,
      email: 'hello2@gmail.com',
      events: ['event-2']
    },
    "3": {
      userName: 'user3',
      id: 3,
      email: 'hello3@gmail.com',
      events: ['event-4']
    }
  },
  addUser(user: User): User {
    this.users[user.id.toString()] = user;
    return user;
  },
  getUser(id: string): User {
    return this.users[id];
  },
  getUsers(): User[] {
    return Object.values(this.users);
  },
  addEventTouUser(userId: number, eventId: string): void {
    const userKey = userId.toString();
    if (this.users[userKey]) {
      this.users[userKey].events.push(eventId);
    }
  }
};

const eventStore: EventStore = {
  events: {
    "event-1": {
      id: 1,
      name: 'Event 1',
      userId: 1,
      details: 'This is the first event'
    },
    "event-2": {
      id: 2,
      name: 'Event 2',
      userId: 2,
      details: 'This is the second event'
    },
    "event-3": {
      id: 3,
      name: 'Event 3',
      userId: 1,
      details: 'This is the third event'
    },
    "event-4": {
      id: 4,
      name: 'Event 4',
      userId: 3,
      details: 'This is the fourth event'
    }
  },
  addEvent(event: Event): Event {
    this.events[event.id.toString()] = event;
    return event;
  },
  getEvent(id: string): Event {
    return this.events[id];
  },
  getEvents(): Event[] {
    return Object.values(this.events);
  }
};

// Provide the server-side API with the request handlers.
const server = setupServer(
  http.get('http://event.com/getUsers', () => {
    if (Math.random() < 0.05) {
      return HttpResponse.error();
    } 
    return HttpResponse.json(userStore.getUsers());
  }),

  http.get('http://event.com/getUserById/:id', ({ params }) => {
    const id = params.id as string;
    return HttpResponse.json(userStore.getUser(id));
  }),
  
  http.post('http://event.com/addEvent', async ({ request }) => {
    requestCount++;
    // Simulate a successful response for the first 5 requests
    if (requestCount <= 5 || requestCount === 0) {
      const requestBody = await request.json() as Event & { userId: number };
      eventStore.addEvent(requestBody);
      userStore.addEventTouUser(requestBody.userId, requestBody.id.toString());
      return HttpResponse.json({
        success: true
      });
    } 
    // Then fail for the next 10 requests
    else {
      if (requestCount >= 15) {
        requestCount = 0;
      }
      await delay(100);
      return HttpResponse.json({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'Event API is experiencing high load'
      }, {
        status: 503,
      });
    }
  }),

  http.get('http://event.com/getEvents', () => {
    if (Math.random() < 0.05) {
      return HttpResponse.error();
    } 
    return HttpResponse.json(eventStore.getEvents());
  }),

  http.get('http://event.com/getEventById/:id', async ({ params }) => {
    await delay(500);
    const id = params.id as string;
    return HttpResponse.json(eventStore.getEvent(id));
  }),
);

const listenMock = (): void => {
  // Start the interception.
  server.listen();
};

export default listenMock;