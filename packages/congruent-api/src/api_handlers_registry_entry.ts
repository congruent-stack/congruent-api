import { ICanTriggerAsync } from "./api_can_trigger.js";
import { DIContainer, DIScope } from "./di_container.js";
import { HttpMethodEndpoint, IHttpMethodEndpointDefinition, ValidateHttpMethodEndpointDefinition } from "./http_method_endpoint.js";
import { HttpMethodEndpointHandler } from "./http_method_endpoint_handler.js";
import { BadRequestValidationErrorResponse, HttpMethodEndpointHandlerOutput, HttpResponseObject, isHttpResponseObject } from "./http_method_endpoint_handler_output.js";
import { HttpStatusCode } from "./http_status_code.js";
import z from "zod";
import { TypedPathParams } from "./typed_path_params.js";
import { IEndpointHandlerDecorator } from "./endpoint_handler_decorator.js";
import { HttpRequestObject } from "./http_method_endpoint_handler_input.js";
import { EndpointHandlerContext } from "./handler_context.js";

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

  private readonly _decoratorFactories: ((scope: DIScope<any>) => IEndpointHandlerDecorator<any>)[] = [];
  public get decoratorFactories(): ((scope: DIScope<any>) => IEndpointHandlerDecorator<any>)[] {
    return this._decoratorFactories;
  }

  /**
   * 
   * @param decoratorFactory must be a function that takes exactly the DI scope type and returns an instance of a class that implements IEndpointHandlerDecorator
   * @returns this
   * 
   * Initially, the method was defined as:
   * ```ts
   * decorate<
   *   TDecoratorSchemas extends IDecoratorHandlerSchemas, 
   *   TDecorator extends IEndpointHandlerDecorator<TDecoratorSchemas>
   * > (
   *   decoratorFactory: IEndpointHandlerDecoratorFactory<TDecoratorSchemas, TDIContainer, TDecorator>
   * ): this {
   *   this._decoratorFactories.push(decoratorFactory);
   *   return this;
   * }
   * ```
   * 
   * and the type IEndpointHandlerDecoratorFactory was defined as:
   * ```ts
   * type IEndpointHandlerDecoratorFactory<
   *   TDecoratorSchemas extends IDecoratorHandlerSchemas, 
   *   TDIContainer extends DIContainer, 
   *   TDecorator extends IEndpointHandlerDecorator<TDecoratorSchemas>
   * > = (diScope: ReturnType<TDIContainer['createScope']>) => TDecorator;
   * ```
   * 
   * However, TypeScript was incorrectly inferring the types when using the 'decorate' method. 
   * The end developer would have had to explicitly provide the generic types, which is not ideal.
   * 
   * With the current definition, TypeScript can infer the types from the decoratorFactory parameter, 
   * making it easier to use.
   */
  decorate<
    TDecorator extends { 
      // ⚠️⚠️⚠️ if IEndpointHandlerDecorator is changed, change it also here ⚠️⚠️⚠️
      handle(input: any, context: any): Promise<any> 
    }
  > (
    decoratorFactory:
      // Must be a function that takes exactly the DI scope type
      ((diScope: ReturnType<TDIContainer['createScope']>) => TDecorator) extends infer TExpected
        ? TDecorator extends IEndpointHandlerDecorator<infer _TSchemas>
          ? TExpected
          : "❌ ERROR: The decoratorFactory must return an instance of a class that implements IEndpointHandlerDecorator"
        : never
  ): this {
    this._decoratorFactories.push(decoratorFactory as any);
    return this;
  }

  decorateWith<
    TDecorator extends { 
      // ⚠️⚠️⚠️ if IEndpointHandlerDecorator is changed, change it also here ⚠️⚠️⚠️
      handle(input: any, context: any): Promise<any> 
    }
  > (
    decoratorStaticMethodFactory: (
      {
        new (...args: any[]): TDecorator;
        create(diScope: ReturnType<TDIContainer['createScope']>): TDecorator;
      } extends infer TExpected
        ? TDecorator extends IEndpointHandlerDecorator<infer _TSchemas>
          ? TExpected
          : "❌ ERROR: The decoratorStaticMethodFactory must be a class that implements IEndpointHandlerDecorator and has a static 'create' method that takes exactly the DI scope type and returns an instance of the class"
        : never
    )
  ): this {
    this._decoratorFactories.push(decoratorStaticMethodFactory.create as any);
    return this;
  }

  async trigger(
    diScope: ReturnType<TDIContainer['createScope']>,
    requestObject: { 
      headers: TDef['headers'] extends z.ZodType ? z.output<TDef['headers']> : Record<string, string>; // z.output because the handler receives the parsed input
      pathParams: TypedPathParams<TPathParams>;
      query: TDef['query'] extends z.ZodType ? z.output<TDef['query']> : null; // z.output because the handler receives the parsed input
      body: TDef['body'] extends z.ZodType ? z.output<TDef['body']> : null; // z.output because the handler receives the parsed input
    }
  ): Promise<any> {
    return this.triggerNoStaticTypeCheck(diScope, requestObject as any, {});
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

    const path = this._methodEndpoint.createPath(requestObject.pathParams);

    return await this._handler({ 
      method: this._methodEndpoint.method,
      path,
      genericPath: this._methodEndpoint.genericPath,
      pathSegments: this._methodEndpoint.pathSegments,
      headers,
      pathParams: requestObject.pathParams as any, 
      query,
      body,
    }, injected as any) as any;
  }

  async triggerNoStaticTypeCheck(
    diScope: DIScope<any>,
    requestObject: HttpRequestObject,
    context: EndpointHandlerContext<any>
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

    const path = this._methodEndpoint.createPath(requestObject.pathParams);

    Object.assign(context, this._injection(diScope));

    return await this._handler({ 
      method: this._methodEndpoint.method,
      path,
      genericPath: this._methodEndpoint.genericPath,
      pathSegments: this._methodEndpoint.pathSegments,
      headers,
      pathParams: requestObject.pathParams as any, 
      query,
      body,
    }, context);
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