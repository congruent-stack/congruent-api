import { treeifyError, z } from 'zod';
import { IHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpStatusCode, isHttpStatusCode } from './http_status_code.js';
import { HttpMethodEndpointResponse } from './http_method_endpoint_response.js';
import { FailedValidationSections } from './failed_validation_sections.js';

export type HttpMethodEndpointHandlerOutput<TEndpointDefinition extends IHttpMethodEndpointDefinition> = {
  [THttpStatusCode in keyof TEndpointDefinition['responses'] & HttpStatusCode]:
    TEndpointDefinition['responses'][THttpStatusCode] extends HttpMethodEndpointResponse<THttpStatusCode, infer TRespDef>
      ? CreateHandlerOutput<THttpStatusCode, TRespDef>
      : never;
}[keyof TEndpointDefinition['responses'] & HttpStatusCode]
| {
  code: HttpStatusCode.BadRequest_400;
  headers: {
    "x-failed-validation-sections": FailedValidationSections<TEndpointDefinition>;
  };
  body: ReturnType<typeof treeifyError<Exclude<TEndpointDefinition['headers'] | TEndpointDefinition['query'] | TEndpointDefinition['body'], undefined>>>;
} 
| {
  code: HttpStatusCode.InternalServerError_500;
  headers?: unknown;
  body?: {};
};

// zod v4 infers z.input<z.object({})> as Record<string, never> (empty strip schema).
// TypeScript widens {} literals in multi-branch functions to { prop?: undefined },
// which fails the Record<string, never> index-signature check.
// When the schema gives Record<string, never>, widen the expected input to Record<string, unknown>
// so developers can naturally return {} (zod validates and strips at runtime).
export type NormalizedResponseZodInput<TSchema extends z.ZodType> =
  [z.input<TSchema>] extends [Record<string, never>] 
    ? Record<string, unknown> 
    : z.input<TSchema>;

export type CreateHandlerOutput<THttpStatusCode extends HttpStatusCode, TRespDef> =
  TRespDef extends { headers: z.ZodType; body: z.ZodType; }
    ? {
        code: THttpStatusCode;
        headers: NormalizedResponseZodInput<TRespDef['headers']>;
        body: NormalizedResponseZodInput<TRespDef['body']>;
      }
    : TRespDef extends { headers: z.ZodType; }
      ? {
          code: THttpStatusCode;
          headers: NormalizedResponseZodInput<TRespDef['headers']>;
          // Explicitly forbid body property when response has no body
          body?: never; // it still allows assigning undefined to it, but that is fine
        }
      : TRespDef extends { body: z.ZodType; }
        ? {
            code: THttpStatusCode;
            // Explicitly forbid headers property when response has no headers
            headers?: never; // it still allows assigning undefined to it, but that is fine
            body: NormalizedResponseZodInput<TRespDef['body']>;
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

export function isHttpResponseObject(obj: any): obj is HttpResponseObject {
  return (
    obj !== null
    && typeof obj === 'object' 
    && 'code' in obj
    && isHttpStatusCode(obj.code)
  );
}