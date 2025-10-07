import { IHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { ClientHttpMethodEndpointHandlerInput, HttpMethodEndpointHandlerInput } from "./http_method_endpoint_handler_input.js";
import { ClientHttpMethodEndpointHandlerOutput, HttpMethodEndpointHandlerOutput } from "./http_method_endpoint_handler_output.js";
import { EndpointHandlerContext } from "./handler_context.js";

export type HttpMethodEndpointHandler<
  TDef extends IHttpMethodEndpointDefinition,
  TPathParams extends string,
  TInjected
> = 
  (input: HttpMethodEndpointHandlerInput<TDef, TPathParams>, context: EndpointHandlerContext<TInjected>) => Promise<HttpMethodEndpointHandlerOutput<TDef>>;

export type ClientHttpMethodEndpointHandler = 
  (input: ClientHttpMethodEndpointHandlerInput) => Promise<ClientHttpMethodEndpointHandlerOutput>;