import { ICanTriggerAsync } from "./api_can_trigger.js";
import { DIContainer, DIScope } from "./di_container.js";
import { HttpMethodEndpoint, IHttpMethodEndpointDefinition, ValidateHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpMethodEndpointHandler } from "./http_method_endpoint_handler.js";
import { BadRequestValidationErrorResponse, HttpMethodEndpointHandlerOutput, HttpResponseObject, isHttpResponseObject } from "./http_method_endpoint_handler_output.js";
import { HttpStatusCode } from "./http_status_code.js";
import z from "zod";
import { TypedPathParams } from "./typed_path_params.js";
import { DecoratorHandlerSchemas, IEndpointHandlerDecorator, IEndpointHandlerDecoratorConstructor } from "./endpoint_handler_decorator.js";

export type PrepareRegistryEntryCallback<
  TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string
> = (entry: MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams, any>) => void;

export type OnHandlerRegisteredCallback<
  TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string
> = (entry: MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams, any>) => void;

// type DecoratorConstructor<
//   TDIContainer extends DIContainer,
//   T extends IEndpointHandlerDecorator
// > = (/*new*/ (scope: ReturnType<TDIContainer['createScope']>) => T);

export class MethodEndpointHandlerRegistryEntry<
  TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  TDIContainer extends DIContainer,
  TPathParams extends string,
  TInjected = {}
> implements ICanTriggerAsync {
  private _methodEndpoint: HttpMethodEndpoint<TDef>;
  get methodEndpoint(): HttpMethodEndpoint<TDef> {
    return this._methodEndpoint;
  }

  private _dicontainer: TDIContainer;
  public get dicontainer(): TDIContainer {
    return this._dicontainer;
  }

  constructor(methodEndpoint: HttpMethodEndpoint<TDef>, dicontainer: TDIContainer) {
    this._methodEndpoint = methodEndpoint;
    this._dicontainer = dicontainer;
  }

  public get genericPath(): string {
    return this._methodEndpoint.genericPath;
  }

  private _handler: HttpMethodEndpointHandler<TDef, TPathParams, TInjected> | null = null;
  public get handler(): HttpMethodEndpointHandler<TDef, TPathParams, TInjected> | null {
    return this._handler;
  }

  register(handler: HttpMethodEndpointHandler<TDef, TPathParams, TInjected>): this {
    this._handler = handler;
    if (this._onHandlerRegisteredCallback) {
      this._onHandlerRegisteredCallback(this);
    }
    return this;
  }

  private _onHandlerRegisteredCallback: OnHandlerRegisteredCallback<TDef, TDIContainer, TPathParams> | null = null;
  _onHandlerRegistered(callback: OnHandlerRegisteredCallback<TDef, TDIContainer, TPathParams>): void {
    this._onHandlerRegisteredCallback = callback;
  }

  prepare(callback: PrepareRegistryEntryCallback<TDef, TDIContainer, TPathParams>) {
    callback(this);
    return this;
  }

  private _injection: any = (_diScope: DIScope<any>) => ({});
  public get injection(): any {
    return this._injection;
  }

  inject<TNewInjected>(injection: (diScope: ReturnType<TDIContainer['createScope']>) => TNewInjected): MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams, TNewInjected> {
    this._injection = injection;
    return this as unknown as MethodEndpointHandlerRegistryEntry<TDef, TDIContainer, TPathParams, TNewInjected>;
  }

  private readonly _decoratorConstructors: IEndpointHandlerDecoratorConstructor<any, TDIContainer, any>[] = [];
  public get decoratorConstructors(): IEndpointHandlerDecoratorConstructor<any, TDIContainer, any>[] {
    return this._decoratorConstructors;
  }

  decorate<
    TDecoratorSchemas extends DecoratorHandlerSchemas, 
    T extends IEndpointHandlerDecorator<TDecoratorSchemas>
  > (
    Decorator: IEndpointHandlerDecoratorConstructor<TDecoratorSchemas, TDIContainer, T>
  ): this {
    this._decoratorConstructors.push(Decorator);
    return this;
  }

  // POSSIBLE SOLUTION (*)
  // comment the above decorate method and uncomment the below overloads and implementation
  // this solution problem: create method signature is not enforced anymore, only that is present

  // // Simple overload that accepts any decorator constructor that follows the pattern
  // decorate(
  //   Decorator: IEndpointHandlerDecoratorConstructor<any, TDIContainer, any>
  // ): this;
  
  // // Explicit generic version for cases where you want full type checking
  // decorate<
  //   TDecoratorSchemas extends DecoratorHandlerSchemas, 
  //   T extends IEndpointHandlerDecorator<TDecoratorSchemas>
  // > (
  //   Decorator: IEndpointHandlerDecoratorConstructor<TDecoratorSchemas, TDIContainer, T>
  // ): this;
  
  // // Implementation
  // decorate(Decorator: any): this {
  //   this._decoratorConstructors.push(Decorator);
  //   return this;
  // }

  async trigger(
    diScope: ReturnType<TDIContainer['createScope']>,
    requestObject: { 
      headers: TDef['headers'] extends z.ZodType ? z.output<TDef['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
      pathParams: TypedPathParams<TPathParams>;
      query: TDef['query'] extends z.ZodType ? z.output<TDef['query']> : null; // z.output because the handler receives the parsed input
      body: TDef['body'] extends z.ZodType ? z.output<TDef['body']> : null; // z.output because the handler receives the parsed input
    }
  ): Promise<any> {
    return this.triggerNoStaticTypeCheck(diScope, requestObject as any);
  }

  async exec(
    injected: TInjected,
    requestObject: { 
      headers: TDef['headers'] extends z.ZodType ? z.output<TDef['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
      pathParams: TypedPathParams<TPathParams>;
      query: TDef['query'] extends z.ZodType ? z.output<TDef['query']> : null; // z.output because the handler receives the parsed input
      body: TDef['body'] extends z.ZodType ? z.output<TDef['body']> : null; // z.output because the handler receives the parsed input
    }
  ): Promise<HttpMethodEndpointHandlerOutput<TDef> | BadRequestValidationErrorResponse> {
    if (!this._handler) {
      throw new Error('Handler not set for this endpoint');
    }

    let badRequestResponse: HttpResponseObject | null = null;

    const headers = parseRequestDefinitionField(this._methodEndpoint.definition, 'headers', requestObject);
    if (isHttpResponseObject(headers)) {
      badRequestResponse = headers;
      return badRequestResponse as any;
    }

    const query = parseRequestDefinitionField(this._methodEndpoint.definition, 'query', requestObject);
    if (isHttpResponseObject(query)) {
      badRequestResponse = query;
      return badRequestResponse as any;
    }

    const body = parseRequestDefinitionField(this._methodEndpoint.definition, 'body', requestObject);
    if (isHttpResponseObject(body)) {
      badRequestResponse = body;
      return badRequestResponse as any;
    }

    const path = this.createPath(requestObject.pathParams);

    return await this._handler({ 
      method: this._methodEndpoint.method,
      path,
      genericPath: this._methodEndpoint.genericPath,
      pathSegments: this._methodEndpoint.pathSegments,
      headers,
      pathParams: requestObject.pathParams as any, 
      query,
      body,
      injected,
    }) as any;
  }

  async triggerNoStaticTypeCheck(
    diScope: DIScope<any>,
    requestObject: { 
      headers: Record<string, string>,
      pathParams: Record<string, string>,
      query: object,
      body: object,
    }
  ): Promise<any> {
    if (!this._handler) {
      throw new Error('Handler not set for this endpoint');
    }

    let badRequestResponse: HttpResponseObject | null = null;

    const headers = parseRequestDefinitionField(this._methodEndpoint.definition, 'headers', requestObject);
    if (isHttpResponseObject(headers)) {
      badRequestResponse = headers;
      return badRequestResponse;
    }

    const query = parseRequestDefinitionField(this._methodEndpoint.definition, 'query', requestObject);
    if (isHttpResponseObject(query)) {
      badRequestResponse = query;
      return badRequestResponse;
    }

    const body = parseRequestDefinitionField(this._methodEndpoint.definition, 'body', requestObject);
    if (isHttpResponseObject(body)) {
      badRequestResponse = body;
      return badRequestResponse;
    }

    const path = this.createPath(requestObject.pathParams);

    return await this._handler({ 
      method: this._methodEndpoint.method,
      path,
      genericPath: this._methodEndpoint.genericPath,
      pathSegments: this._methodEndpoint.pathSegments,
      headers,
      pathParams: requestObject.pathParams as any, 
      query,
      body,
      injected: this._injection(diScope),
    });
  }

  private createPath(pathParams: Record<string, string>): string {
    return `/${this._methodEndpoint.pathSegments.map(segment => 
      segment.startsWith(':') 
      ? (pathParams[segment.slice(1)] ?? '?') 
      : segment
    ).join('/')}`;
  }
}

function parseRequestDefinitionField<
  TDef extends IHttpMethodEndpointDefinition & ValidateHttpMethodEndpointDefinition<TDef>,
  T extends Record<string, any>
>(
  definition: TDef,
  key: 'headers' | 'query' | 'body',
  requestObject: T
): any {
  if (definition[key]) {
    if (
      !(key in requestObject)
      || requestObject[key as keyof T] === null
      || requestObject[key as keyof T] === undefined
    ) {
      // definition[key].isOptional was deprecated in favour of safeParse with success check
      const result = definition[key].safeParse(requestObject[key as keyof T]);
      if (!result.success) {
        // since frameworks are not consistent in sending null vs undefined for missing request object parts, 
        // we handle both cases here, so that
        // we handle missing parts of the request object according to how the schema defines them
        switch (definition[key].type) {
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
    const result = definition[key].safeParse(requestObject[key as keyof T]);
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