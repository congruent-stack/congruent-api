import z from "zod";
import { DIContainer } from "./di_container.js";
import { HttpMethodEndpoint, HttpMethodEndpointResponses } from "./http_method_endpoint.js";
import { HttpMethod } from "./http_method_type.js";
import { HttpStatusCode } from "./http_status_code.js";
import { HttpMethodEndpointResponse } from "./http_method_endpoint_response.js";
import { CreateHandlerOutput, HttpResponseObject, isHttpResponseObject } from "./http_method_endpoint_handler_output.js";
import { HttpRequestObject } from "./http_method_endpoint_handler_input.js";
import { MiddlewareHandlersRegistryEntryInternal } from "./api_middleware.js";
import { DecoratorHandlerContext } from "./handler_context.js";

export interface IDecoratorHandlerSchemas {
  headers?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  responses: HttpMethodEndpointResponses;
};

export type DecoratorHandlerInput<
  TDecoratorSchemas extends IDecoratorHandlerSchemas
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

export type DecoratorHandlerOutput<TDecoratorSchemas extends IDecoratorHandlerSchemas> =
  | void
  | {
    [THttpStatusCode in keyof TDecoratorSchemas['responses'] & HttpStatusCode]: 
      TDecoratorSchemas['responses'][THttpStatusCode] extends HttpMethodEndpointResponse<THttpStatusCode, infer TRespDef>
        ? CreateHandlerOutput<THttpStatusCode, TRespDef>
        : never;
  }[keyof TDecoratorSchemas['responses'] & HttpStatusCode];

export interface IEndpointHandlerDecorator<
  TDecoratorSchemas extends IDecoratorHandlerSchemas
> {
  handle(
    input: DecoratorHandlerInput<TDecoratorSchemas>, 
    context: DecoratorHandlerContext
  ): Promise<DecoratorHandlerOutput<TDecoratorSchemas>>;
}

export type EndpointHandlerDecoratorFactory<
  TDecoratorSchemas extends IDecoratorHandlerSchemas,
  TDIContainer extends DIContainer,
  TDecorator extends IEndpointHandlerDecorator<TDecoratorSchemas>
> = (diScope: ReturnType<TDIContainer['createScope']>) => TDecorator;

export async function triggerEndpointDecoratorNoStaticTypeCheck(
  endpoint: HttpMethodEndpoint<any>,
  decorator: IEndpointHandlerDecorator<any>,
  requestObject: HttpRequestObject, 
  context: DecoratorHandlerContext
) {
  let badRequestResponse: HttpResponseObject | null = null;
  
  const headers = decoratorParseRequestDefinitionField(endpoint.definition, 'headers', requestObject);
  if (isHttpResponseObject(headers)) {
    badRequestResponse = headers;
    return badRequestResponse;
  }

  const query = decoratorParseRequestDefinitionField(endpoint.definition, 'query', requestObject);
  if (isHttpResponseObject(query)) {
    badRequestResponse = query;
    return badRequestResponse;
  }

  const body = decoratorParseRequestDefinitionField(endpoint.definition, 'body', requestObject);
  if (isHttpResponseObject(body)) {
    badRequestResponse = body;
    return badRequestResponse;
  }

  const path = endpoint.createPath(requestObject.pathParams);

  return decorator.handle({ 
    ...requestObject,
    method: endpoint.method,
    genericPath: endpoint.genericPath,
    path,
    pathSegments: endpoint.pathSegments,
  }, context);
}

export async function triggerMiddlewareDecoratorNoStaticTypeCheck(
  middlewareEntry: MiddlewareHandlersRegistryEntryInternal<any, unknown>,
  decorator: IEndpointHandlerDecorator<any>,
  requestObject: HttpRequestObject, 
  context: DecoratorHandlerContext
) {
  let badRequestResponse: HttpResponseObject | null = null;
  
  const headers = decoratorParseRequestDefinitionField(middlewareEntry.middlewareSchemas, 'headers', requestObject);
  if (isHttpResponseObject(headers)) {
    badRequestResponse = headers;
    return badRequestResponse;
  }

  const query = decoratorParseRequestDefinitionField(middlewareEntry.middlewareSchemas, 'query', requestObject);
  if (isHttpResponseObject(query)) {
    badRequestResponse = query;
    return badRequestResponse;
  }

  const body = decoratorParseRequestDefinitionField(middlewareEntry.middlewareSchemas, 'body', requestObject);
  if (isHttpResponseObject(body)) {
    badRequestResponse = body;
    return badRequestResponse;
  }

  const path = middlewareEntry.createPath(requestObject.pathParams);

  return decorator.handle({ 
    ...requestObject,
    method: middlewareEntry.method as HttpMethod, // TODO: might be empty, as middleware can be registered with path only, without method
    genericPath: middlewareEntry.genericPath,
    path,
    pathSegments: middlewareEntry.pathSegments,
  }, context);
}

function decoratorParseRequestDefinitionField<
  T extends Record<string, any>
>(
  decoratorSchemas: IDecoratorHandlerSchemas,
  key: 'headers' | 'query' | 'body',
  requestObject: T
): any {
  if (decoratorSchemas[key]) {
    if (
      !(key in requestObject)
      || requestObject[key as keyof T] === null
      || requestObject[key as keyof T] === undefined
    ) {
      // decoratorSchemas[key].isOptional was deprecated in favour of safeParse with success check
      const result = decoratorSchemas[key].safeParse(requestObject[key as keyof T]);
      if (!result.success) {
        // since frameworks are not consistent in sending null vs undefined for missing request object parts, 
        // we handle both cases here, so that
        // we handle missing parts of the request object according to how the schema defines them
        switch (decoratorSchemas[key].type) {
          case 'optional':
            if (requestObject[key] === null) {
              return undefined;
            }
            break;
          case 'nullable':
            if (requestObject[key] === undefined) {
              return null;
            }
            break;
        }
        return { 
          code: HttpStatusCode.BadRequest_400, 
          body: `'${key}' is required for this endpoint` + (
            key === 'body' ? ", { 'Content-Type': 'application/json' } header might be missing" : ''
          )
        };
      }
      return result.data;
    }
    const result = decoratorSchemas[key].safeParse(requestObject[key as keyof T]);
    if (!result.success) {
      return { 
        code: HttpStatusCode.BadRequest_400, 
        body: result.error.issues
      };
    }
    return result.data;
  }
  return null; // by design, if request object parts are not defined through schema, we set them to null
}
