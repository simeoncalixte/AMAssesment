# What is missing?

This file is meant to list missing features to ensure that the project is production ready.

## TypeScript Integration
- [x] Migrate the codebase from JavaScript to TypeScript.
- [x] Define interfaces and types for all data structures and function signatures.

## Error Handling
- [ ] Implement centralized error handling middleware in Fastify.
- [ ] Create custom error classes for different error types (e.g ExternalServiceError, ValidationError).
- [ ] Ensure all API endpoints return meaningful error messages and appropriate HTTP status codes.

## Benchmark Tests
- [ ] Add benchmark tests to measure performance of critical functions.
- [ ] Create timestamps for performance comparisons over time.
- [ ] Document benchmark results and any performance improvements made.

## Jest Tests and Coverage
- [x] Write unit tests for all functions and components.
- [ ] Achieve at least 90% code coverage.


## Documentation
- [ ] Apply consistent formatting and style across all node modules and eslint rules.
- [x] Add swagger files for API documentation.
- [ ] Create a comprehensive README file with setup instructions, usage examples, and contribution guidelines.
- [ ] Document all functions and classes with JSDoc comments or proper typings.

## CI/CD Pipeline
- [] Set up a continuous integration pipeline to run tests on every commit.
- [ ] Implement a continuous deployment process to automate releases to development, staging and production environments.
- [ ] Ensure that the CI/CD pipeline includes steps for linting, testing, and building the project.

## Feature Improvements

- [x] Detect when the external service is consistently failing (3+ failures within a 30-second window)
- [x] Implement a backoff/retry mechanism that reduces the load on the external service during failure periods
- [x] Gradually test if the service has recovered and resume normal operations when it's available again
- [x] Provide appropriate error responses to clients when the external service is unavailable