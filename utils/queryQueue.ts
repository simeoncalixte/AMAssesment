
interface QueryState  {
    numberOfCalls: number;
    numberOfFailures: number;
    currentActiveCalls: Record<number, boolean>;
    calls: Record<
        number,
        { args: any[]; timestamp: number; func: Function, retries?: number }
    >;
}

const MAX_RETRIES_PER_DAY = 300;
const MAX_ACTIVE_CALLS = 5;

const areActiveCallsFull = (queryState: QueryState) : boolean => {
  return queryState.currentActiveCalls && Object.keys(queryState.currentActiveCalls).length >= MAX_ACTIVE_CALLS;
}

/**
 * Attempts to run the provided function, if there is an error, it will be caught by the caller. 
 * If successful, it updates the query state accordingly.
 * @param index The index of the call in the queryState.calls record
 * @param queryState The state object tracking calls and their statuses
 * @param func The function to be executed
 * @param resolve The resolve function of the promise
 * @param args The arguments to be passed to the function
 */
const attemptCallbackRun = async (index: number, queryState: QueryState, func: Function, resolve: Function, ...args: unknown[])  => {
    queryState.currentActiveCalls[index] = true;
    const callResult = await func(...args);
    resolve(callResult);
    delete queryState.currentActiveCalls[index];
    queryState.numberOfCalls--;
};

/**
 * Handles errors during function execution and schedules retries if necessary.
 * @param retryFunc the function to call for retrying the failed function call
 * @param index the index of the call in the queryState.calls record
 * @param queryState the state object tracking calls and their statuses
 * @param func the function to be executed
 * @param resolve the resolve function of the promise
 * @param args the arguments to be passed to the function
 */
const handleRunErrorsAndRetries = async (retryFunc: Function, index: number, queryState: QueryState, func: Function, resolve: Function, ...args: unknown[]) => {
  const currentRetryCount = queryState.calls[index].retries || 0;
  // Limit retries to avoid infinite loops, but allow for a reasonable number of attempts, 
  // Usually issues like these are persisted in some database somewhere, logged, and trigger alerts for awareness and manual intervention.
  if( currentRetryCount > MAX_RETRIES_PER_DAY){
    delete queryState.currentActiveCalls[index];
    delete queryState.calls[index];
    throw new Error('Max retries exceeded');
  } 
  queryState.numberOfFailures++;
  queryState.calls[index].retries = currentRetryCount + 1;
  await retryFunc(index, func, resolve, queryState, ...args);
}

/**
 * Orchestrates the retry mechanism with backoff for failed function calls.
 * @param index the index of the call in the queryState.calls record
 * @param func the function to be executed
 * @param resolve the resolve function of the promise
 * @param queryState the state object tracking calls and their statuses
 * @param args the arguments to be passed to the function
 */
const retryCallback = async (index: number, func: Function, resolve: Function, queryState: QueryState, ...args: unknown[]) => {
  // - [x] Implement a backoff/retry mechanism that reduces the load on the external service during failure periods
  const isFull = areActiveCallsFull(queryState);
  const backOff = Math.pow(2, (queryState.numberOfFailures > 3 ?  3 :  queryState.numberOfFailures));
  setTimeout(async () => {
    try {
      await attemptCallbackRun(index, queryState, func, resolve, ...args);
      if((queryState.calls[index].retries || 0) > 0){
        queryState.numberOfFailures--;
      }
    } catch (error) {
      // Detect errors (e.g network issues, rate limiting) and schedule a retry
      // - [x] Implement a backoff/retry mechanism that reduces the load on the external service during failure periods
        await handleRunErrorsAndRetries(retryCallback, index, queryState, func, resolve, ...args);
      }
  },  isFull  ?  100 + backOff : backOff);
};


/**
 * Creates a promise executor function that manages the queuing and execution of function calls.
 * This should be used as the callback for new Promise() to ensure proper queuing.
 * @param queryState The state object tracking calls and their statuses.
 * @param func The function to be executed.
 * @param args The arguments to be passed to the function.
 * @returns A promise executor function.
 */
const createPromiseExecutor = ( 
  queryState: QueryState,
  func: Function,
  args: unknown[]
) => (resolve: Function, reject: Function) => {
      const callIndex = queryState.numberOfCalls;
      queryState.calls[queryState.numberOfCalls] = {
        args,
        timestamp: Date.now(),
        func: func,
        retries: 0
      };
      queryState.numberOfCalls++;
      try{
        retryCallback(callIndex, func, resolve, queryState, ...args);
      }catch(error){
        reject(error);
     }
}

/**
 * Wraps a function with a queuing mechanism to limit the number of active concurrent calls.
 * @param func The function to be wrapped and queued.
 * @returns A new function that manages the execution of the original function with queuing.
 */
export const queryQueue = <T extends Function>(func: T) => {
  // Initialize query state
  const queryState: QueryState = {
    numberOfCalls: 0, // Total number of calls made
    numberOfFailures: 0, // Total number of failed calls dependent on number of retries and absolute failures
    currentActiveCalls: {}, // Tracks currently active calls by their index
    calls: {} // Stores details of each call including arguments, timestamp, function reference, and retry count
  };
  return function (...args: any) {
    // Create and return a new promise for each function call
    const promiseExecutor = createPromiseExecutor(queryState, func, args);
    return new Promise(promiseExecutor);
  };
};
