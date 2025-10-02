import { z } from 'zod';
import { HttpStatusCode } from './http_status_code.js';
import { HttpMethod, LowerCasedHttpMethod } from './http_method_type.js';
import { HttpMethodEndpointResponse } from './http_method_endpoint_response.js';

export function endpoint<TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>>(definition: TDef): HttpMethodEndpoint<TDef> {
  return new HttpMethodEndpoint<TDef>(definition);
}

export interface IHttpMethodEndpointDefinition {
  headers?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  responses: HttpMethodEndpointResponses;
}

export type ValidateHttpMethodEndpointDefinition<TDef extends IHttpMethodEndpointDefinition> = {
  responses: {
    [K in keyof TDef['responses']]: K extends HttpStatusCode
      ? TDef['responses'][K] extends HttpMethodEndpointResponse<infer TStatus, infer TResponseDef>
        ? HttpMethodEndpointResponse<TStatus, TResponseDef> // OK: response under status code key
        : "❌ ERROR: HttpMethodEndpointResponse only allowed on HttpStatusCode key"
      : "❌ ERROR: HttpMethodEndpointResponse only allowed on HttpStatusCode key"
  }
}

export type HttpMethodEndpointResponses = Partial<{
  readonly [status in HttpStatusCode]: HttpMethodEndpointResponse<status, any>;
}>;

export class HttpMethodEndpoint<const TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>> {
  private _definition: TDef;
  get definition(): TDef {
    return this._definition;
  }

  private _pathSegments: readonly string[] = [];
  get pathSegments(): readonly string[] {
    return this._pathSegments;
  }

  private _cachedGenericPath: string | null = null;
  get genericPath(): string {
    if (!this._cachedGenericPath) {
      this._cachedGenericPath = `/${this._pathSegments.join('/')}`;
    }
    return this._cachedGenericPath;
  }

  public createPath(pathParams: Record<string, string>): string {
    return `/${this.pathSegments.map(segment => 
      segment.startsWith(':') 
      ? (pathParams[segment.slice(1)] ?? '?') 
      : segment
    ).join('/')}`;
  }

  private _method: HttpMethod = null as any;
  get method(): HttpMethod {
    return this._method;
  }

  get lowerCasedMethod(): LowerCasedHttpMethod {
    return this._method.toLowerCase() as LowerCasedHttpMethod;
  }

  constructor(definition: TDef) {
    this._definition = definition;
  }

  /** @internal */
  _cloneWith(path: readonly string[], method: string): HttpMethodEndpoint<TDef> {
    const result = new HttpMethodEndpoint<TDef>({
      headers: !!this._definition.headers ? this._definition.headers.clone() : undefined,
      query: !!this._definition.query ? this._definition.query.clone() : undefined,
      body: !!this._definition.body ? this._definition.body.clone() : undefined,
      responses: Object.fromEntries(
        Object.entries(this._definition.responses).map(([status, response]) => [
          status,
          response._clone(),
        ])
      )
    } as TDef);
    result._pathSegments = path;
    result._method = method as HttpMethod;
    return result;
  }
}

