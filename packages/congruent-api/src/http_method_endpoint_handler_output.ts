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

export type CreateHandlerOutput<THttpStatusCode extends HttpStatusCode, TRespDef> = 
  TRespDef extends { headers: z.ZodType; body: z.ZodType; }
    ? {
        code: THttpStatusCode;
        headers: z.input<TRespDef['headers']>;
        body: z.input<TRespDef['body']>;
      }
    : TRespDef extends { headers: z.ZodType; }
      ? {
          code: THttpStatusCode;
          headers: z.input<TRespDef['headers']>;
          // Explicitly forbid body property when response has no body
          body?: never; // it still allows assigning undefined to it, but that is fine
        }
      : TRespDef extends { body: z.ZodType; }
        ? {
            code: THttpStatusCode;
            // Explicitly forbid headers property when response has no headers
            headers?: never; // it still allows assigning undefined to it, but that is fine
            body: z.input<TRespDef['body']>;
          }
        : {
            code: THttpStatusCode;
            // Explicitly forbid headers property when response has no headers
            headers?: never; // it still allows assigning undefined to it, but that is fine
            // Explicitly forbid body property when response has no body
            body?: never; // it still allows assigning undefined to it, but that is fine
          };

export type ClientHttpMethodEndpointHandlerOutput = {
  code: HttpStatusCode;
  headers?: any;
  body: any; //TODO: body is not optional, should I replace ClientHttpMethodEndpointHandlerOutput with HttpResponseObject altogether? 
}

export type HttpResponseObject = {
  code: HttpStatusCode;
  headers?: any;
  body?: any;
}

export type BadRequestValidationErrorResponse = {
  code: HttpStatusCode.BadRequest_400;
  body: z.core.$ZodIssue[] | string; // string for generic errors (e.g. invalid JSON)
}

export function isHttpResponseObject(obj: any): obj is HttpResponseObject {
  return (
    obj !== null
    && typeof obj === 'object' 
    && 'code' in obj
    && isHttpStatusCode(obj.code)
  );
}