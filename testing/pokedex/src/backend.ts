import { DIContainer, HttpStatusCode, createRegistry, route, middleware, response } from "@congruent-stack/congruent-api";
import { contract, CommonHeadersSchema, UnauthorizedResponseBodySchema } from "./contract.js";

export class MyLogger {
  log(message: string) {
    console.log(`[MyLogger] ${message}`);
  }
}

export interface IMyService {
  getYearOfBirth(age: number): number;
}

export class MyService implements IMyService {
  private logger: MyLogger;
  constructor(logger: MyLogger) {
    this.logger = logger;
  }

  getYearOfBirth(age: number): number {
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    this.logger.log(`Calculated birth year: ${birthYear} for age: ${age}`);
    return birthYear;
  }
}

export const container = new DIContainer()
  .registerScoped('Logger', () => new MyLogger())
  .registerScoped('MyService', scope => new MyService(scope.getLogger()) as IMyService);

export const api = createRegistry(container, contract, { handlerRegisteredCallback: () => {}, middlewareHandlerRegisteredCallback: () => {} });

middleware(api, "/somepath")
  .inject((scope) => ({
    logger: scope.getLogger()
  }))
  .register({
    headers: CommonHeadersSchema,
    responses: {
      [HttpStatusCode.Forbidden_403]: response({ 
        body: UnauthorizedResponseBodySchema 
      })
    }
  }, async (req, ctx) => {
    const secret = req.headers.mySecret;
    if (secret !== "123e4567-e89b-12d3-a456-426614174000") {
      ctx.logger.log(`Unauthorized access attempt with secret: ${secret}`);
      return {
        code: HttpStatusCode.Forbidden_403,
        body: {
          userMessage: "You are not authorized to access this resource."
        }
      };
    }
    await ctx.next();
  });

route(api, "POST /somepath/:myparam")
  .inject((scope) => ({
    logger: scope.getLogger(),
    myService: scope.getMyService()
  }))
  .register(async (req, ctx) => {
    ctx.logger.log(`my param = ${req.pathParams.myparam}`);
    const yearOfBirth = ctx.myService.getYearOfBirth(req.body.age);
    return {
      code: HttpStatusCode.OK_200,
      body: `Your year of birth is ${yearOfBirth}`
    };
  });