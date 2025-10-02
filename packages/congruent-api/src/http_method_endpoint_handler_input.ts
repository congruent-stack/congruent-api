import { z } from "zod";
import { IHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpMethod } from "./http_method_type.js";
import { TypedPathParams } from "./typed_path_params.js";

export type HttpMethodEndpointHandlerInput<
  TEndpointDefinition extends IHttpMethodEndpointDefinition,
  TPathParams extends string,
  TInjected
> = {
  method: HttpMethod;
  pathSegments: readonly string[];
  path: string;
  genericPath: string;
  headers: TEndpointDefinition['headers'] extends z.ZodType ? z.output<TEndpointDefinition['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
  pathParams: TypedPathParams<TPathParams>;
  query: TEndpointDefinition['query'] extends z.ZodType ? z.output<TEndpointDefinition['query']> : null; // z.output because the handler receives the parsed input
  body: TEndpointDefinition['body'] extends z.ZodType ? z.output<TEndpointDefinition['body']> : null; // z.output because the handler receives the parsed input
  injected: Readonly<TInjected>;
};

export type ClientHttpMethodEndpointHandlerInput = {
  method: HttpMethod;
  pathSegments: readonly string[];
  path: string;
  genericPath: string;
  headers: Record<string, string>;
  pathParams: Record<string, string>;
  query?: any;
  body?: any;
};

export type HttpRequestObject = {
  headers: Record<string, string>,
  pathParams: Record<string, string>,
  query: Record<string, string>,
  body: object,
}