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
  handle(input: DecoratorHandlerInput<TDecoratorSchemas>, next: () => Promise<void>): Promise<DecoratorHandlerOutput<TDecoratorSchemas>>;
}

export interface IEndpointHandlerDecoratorConstructor<
  TDef extends DecoratorHandlerSchemas,
  TDIContainer extends DIContainer,
  T extends IEndpointHandlerDecorator<TDef>
> {
  new (...args: any[]): T;
  create(diScope: ReturnType<TDIContainer['createScope']>): T;
}