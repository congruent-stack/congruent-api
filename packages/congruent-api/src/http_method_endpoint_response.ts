import z from "zod";
import { HttpStatusCode } from "./http_status_code.js";

export function response<TStatus extends HttpStatusCode, TDef extends IHttpMethodEndpointResponseDefinition<TStatus>>(
  definition: TDef
): HttpMethodEndpointResponse<TStatus, TDef> {
  return new HttpMethodEndpointResponse<TStatus, TDef>(definition);
}

export interface IHttpMethodEndpointResponseDefinition<_TStatus extends HttpStatusCode> {
  headers?: z.ZodType;
  body?: z.ZodType;
}

export class HttpMethodEndpointResponse<
  TStatus extends HttpStatusCode, 
  TDef extends IHttpMethodEndpointResponseDefinition<TStatus>
> {
  
  private _definition: TDef;
  get definition(): TDef {
    return this._definition;
  }

  constructor(definition: TDef) {
    this._definition = definition;
  }

  /** @internal */
  _clone(): HttpMethodEndpointResponse<TStatus, TDef> {
    return new HttpMethodEndpointResponse<TStatus, TDef>(this._definition);
  }
}