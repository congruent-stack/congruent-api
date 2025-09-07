import { z } from 'zod';
import { IHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpStatusCode, isHttpStatusCode } from './http_status_code.js';
import { HttpMethodEndpointResponse } from './http_method_endpoint_response.js';

export type HttpMethodEndpointHandlerOutput<TEndpointDefinition extends IHttpMethodEndpointDefinition> = {
  [THttpStatusCode in keyof TEndpointDefinition['responses'] & HttpStatusCode]: 
    TEndpointDefinition['responses'][THttpStatusCode] extends HttpMethodEndpointResponse<THttpStatusCode, infer TRespDef>
      ? CreateHandlerOutput<THttpStatusCode, TRespDef>
      : never;
}[keyof TEndpointDefinition['responses'] & HttpStatusCode];

type CreateHandlerOutput<THttpStatusCode extends HttpStatusCode, TRespDef> = 
  TRespDef extends { body: z.ZodType }
    ? {
        code: THttpStatusCode;
        body: z.input<TRespDef['body']>;
      }
    : {
        code: THttpStatusCode;
        // Explicitly forbid body property when response has no body
        body?: never; // it still allows undefined, but that is fine
      };

export type ClientHttpMethodEndpointHandlerOutput = {
  code: HttpStatusCode;
  body: any;
}

export type HttpResponseObject = {
  code: HttpStatusCode;
  body?: any;
}

export function isHttpResponseObject(obj: any): obj is HttpResponseObject {
  return (
    obj !== null
    && typeof obj === 'object' 
    && 'code' in obj
    && isHttpStatusCode(obj.code)
  );
}