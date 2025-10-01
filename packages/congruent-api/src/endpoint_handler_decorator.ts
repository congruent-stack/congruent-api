import z from "zod";
import { DIContainer } from "./di_container.js";
import { HttpMethodEndpointResponses } from "./http_method_endpoint.js";
import { HttpMethod } from "./http_method_type.js";
import { HttpStatusCode } from "./http_status_code.js";
import { HttpMethodEndpointResponse } from "./http_method_endpoint_response.js";
import { CreateHandlerOutput } from "./http_method_endpoint_handler_output.js";

export type DecoratorHandlerSchemas = {
  headers?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  responses: HttpMethodEndpointResponses;
};

export type DecoratorHandlerInput<
  TDecoratorSchemas extends DecoratorHandlerSchemas
> = {
  method: HttpMethod;
  pathSegments: readonly string[];
  path: string;
  genericPath: string;
  headers: TDecoratorSchemas['headers'] extends z.ZodType ? z.output<TDecoratorSchemas['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
  pathParams: Record<string, string>;
  query: TDecoratorSchemas['query'] extends z.ZodType ? z.output<TDecoratorSchemas['query']> : null; // z.output because the handler receives the parsed input
  body: TDecoratorSchemas['body'] extends z.ZodType ? z.output<TDecoratorSchemas['body']> : null; // z.output because the handler receives the parsed input
};

export type DecoratorHandlerOutput<TDecoratorSchemas extends DecoratorHandlerSchemas> =
  | void
  | {
    [THttpStatusCode in keyof TDecoratorSchemas['responses'] & HttpStatusCode]: 
      TDecoratorSchemas['responses'][THttpStatusCode] extends HttpMethodEndpointResponse<THttpStatusCode, infer TRespDef>
        ? CreateHandlerOutput<THttpStatusCode, TRespDef>
        : never;
  }[keyof TDecoratorSchemas['responses'] & HttpStatusCode];

export interface IEndpointHandlerDecorator<
  TDecoratorSchemas extends DecoratorHandlerSchemas
> {
  handle(
    input: DecoratorHandlerInput<TDecoratorSchemas>, 
    next: () => Promise<void>
  ): Promise<DecoratorHandlerOutput<TDecoratorSchemas>>;
}

// export interface IEndpointHandlerDecoratorConstructor<
//   TDef extends DecoratorHandlerSchemas,
//   TDIContainer extends DIContainer,
//   T extends IEndpointHandlerDecorator<TDef>
// > {
//   new (...args: any[]): T;
//   create(diScope: ReturnType<TDIContainer['createScope']>): T;
// }

export type EndpointHandlerDecoratorFactory<
  TDecoratorSchemas extends DecoratorHandlerSchemas,
  TDIContainer extends DIContainer,
  TDecorator extends IEndpointHandlerDecorator<TDecoratorSchemas>
> = (diScope: ReturnType<TDIContainer['createScope']>) => TDecorator;

// /**
//  * Helper type to extract the schema type from a decorator instance type
//  */
// export type ExtractDecoratorSchemas<T> = T extends IEndpointHandlerDecorator<infer TSchemas> ? TSchemas : never;

// /**
//  * Helper type to enforce strict parameter checking for decorator factories.
//  * This type uses a method signature (not a function signature) to avoid bivariance issues.
//  */
// export type StrictDecoratorFactory<TDIScope, TDecorator> = {
//   createDecorator(diScope: TDIScope): TDecorator;
// }['createDecorator'];

// /**
//  * Helper type to check if a function has exactly one REQUIRED parameter
//  * This checks that () => T does NOT match, but (arg) => T DOES match
//  */
// type HasExactlyOneParameter<T> = 
//   T extends () => any 
//     ? false  // Zero parameters - reject
//     : T extends (arg: any) => any 
//       ? true  // At least one parameter - accept
//       : false;

// /**
//  * Helper function to create a properly typed decorator factory with strict parameter validation.
//  * This enables automatic type inference of the schemas from the decorator class AND
//  * enforces that the factory function has exactly one parameter.
//  * 
//  * @example
//  * ```typescript
//  * class MyDecorator implements IEndpointHandlerDecorator<MyDecoratorSchemas> {
//  *   static create(diScope: DIScope<...>) { return new MyDecorator(...); }
//  *   // ... implementation
//  * }
//  * 
//  * // Usage with automatic type inference and parameter validation:
//  * route(registry, 'GET /path')
//  *   .decorate(decoratorFactory(MyDecorator.create))  // ✅ Validates parameter count
//  * ```
//  */
// export function decoratorFactory<
//   TFactory extends (...args: any[]) => any
// >(
//   factory: HasExactlyOneParameter<TFactory> extends true
//     ? TFactory
//     : { error: '❌ Decorator factory must accept exactly one parameter (diScope). Current factory has zero parameters.' }
// ): TFactory {
//   return factory as any;
// }
