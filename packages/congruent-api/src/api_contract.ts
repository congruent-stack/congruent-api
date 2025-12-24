// import { createRegistry, type IRegistrySettings } from "./api_handlers_registry.js";
import { type DIContainer } from "./di_container.js";
import { type ApiHandlersRegistry } from './api_handlers_registry.js'
import { HttpMethodEndpoint } from "./http_method_endpoint.js";
import { HttpMethod } from "./http_method_type.js";

export function apiContract<const TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>>(definition: TDef): ApiContract<TDef> {
  return new ApiContract<TDef>(definition);
}

export interface IApiContractDefinition {
  readonly [key: string]: IApiContractDefinition | HttpMethodEndpoint<any>;
}

function isApiContractDefinition(obj: any): obj is IApiContractDefinition {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && Object.values(obj).every(
    value => value instanceof HttpMethodEndpoint || isApiContractDefinition(value)
  );
}

export type ValidateApiContractDefinition<T> = {
  [K in keyof T]: T[K] extends HttpMethodEndpoint<infer TEndpDef>
    ? K extends HttpMethod
      ? HttpMethodEndpoint<TEndpDef>
      : "❌ ERROR: HttpMethodEndpoint only allowed on HttpMethod key"
    : K extends HttpMethod
      ? " ❌ ERROR: method key must hold an HttpMethodEndpoint"
      : T[K] extends object
        ? ValidateApiContractDefinition<T[K]>
        : T[K];
};

export class ApiContract<const TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>> {
  
  readonly definition: TDef;
  constructor(definition: TDef) {
    this.definition = definition;
  }

  cloneInitDef(): TDef {
    return ApiContract._deepCloneInitDef(this.definition, []) as TDef;
  }

  createRegistry<TDIContainer extends DIContainer>(): ApiHandlersRegistry<TDef, TDIContainer> {
    throw new Error('Not adapted yet');
    //return createRegistry<TDef, TDIContainer>(diContainer, this, settings);
  }

  private static _deepCloneInitDef(
    definition: IApiContractDefinition,
    path: readonly string[]
  ): IApiContractDefinition {
    const result: any = {};
    for (const key in definition) {
      const value = definition[key];
      if (value instanceof HttpMethodEndpoint) {
        result[key] = value._cloneWith(path, key);
      } else if (isApiContractDefinition(value)) {
        result[key] = ApiContract._deepCloneInitDef(value, [...path, key]);
      }
    }
    return result as IApiContractDefinition;
  }
}