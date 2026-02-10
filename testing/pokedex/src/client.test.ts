import { expect, test, describe } from 'vitest';
import { createInProcApiClient, HttpStatusCode, RequestFailureCode, route } from '@congruent-stack/congruent-api';
import { contract } from './contract.js';
import { container, api } from './backend.js';

describe('Simple in-process client unit test', () => {
  const testContainer = container.createTestClone()
    .override('Logger', () => {
      return {
        log: (message: string) => {
          // For testing, we can suppress logs
        }
      };
    })
    .override('MyService', (scope) => {
      return {
        getYearOfBirth: (age: number) => {
          // For testing, return a fixed year
          scope.getLogger().log(`Test getYearOfBirth called with age: ${age}`);
          return 2000 - age;
        }
      }
    });

  test('should pass', async () => {
    const client = createInProcApiClient(contract, testContainer, api);
    const response = await client.somepath.myparam(123).POST({
      headers: {
        mySecret: "123e4567-e89b-12d3-a456-426614174000"
      },
      body: {
        age: 25
      }
    });
    if (response.code !== HttpStatusCode.OK_200) {
      expect.fail(`Expected 200 OK but got ${response.code}`);
    }
    expect(response.body).toBe(`Your year of birth is 1975`);
  });

  test('should return 403 for invalid secret', async () => {
    const client = createInProcApiClient(contract, testContainer, api);
    const response = await client.somepath.myparam(123).POST({
      headers: {
        mySecret: "115697d7-cf19-4b88-b4eb-6f340d2cd38a"
      },
      body: {
        age: 25
      }
    });
    if (response.code == RequestFailureCode.ErrorThrown) {
      expect.fail(`Expected 403 Forbidden but got an error thrown: ${response.body}`);
    }
    if (response.code !== HttpStatusCode.Forbidden_403) {
      expect.fail(`Expected 403 Forbidden but got ${response.code}`);
    }
    expect(response.body).toEqual({ userMessage: "You are not authorized to access this resource." });
  });
});

describe('Simple unit test', () => {
  test('should pass', async () => {
    const logger = {
      log: (message: string) => {
        // For testing, we can suppress logs
      }
    };

    const myService = {
      getYearOfBirth: (age: number) => {
        return 2000 - age;
      }
    };

    const response = await route(api, "POST /somepath/:myparam")
      .exec({ logger, myService }, { // TODO: enforce injected types
        headers: {
          mySecret: "123e4567-e89b-12d3-a456-426614174000"
        },
        pathParams: {
          myparam: "123"
        },
        query: null,
        body: {
          age: 25
        }
      });

    if (response.code === HttpStatusCode.BadRequest_400) {
      if (response.headers["x-failed-validation-sections"].includes('headers')) {
        expect.fail(`Headers validation failed: ${JSON.stringify(response.body)}`);
      }
    }

    if (response.code !== HttpStatusCode.OK_200) {
      expect.fail(`Expected 200 OK but got ${response.code}`);
    }
    expect(response.body).toBe(`Your year of birth is 1975`);
  });
});