import { ApiContract, IApiContractDefinition, ValidateApiContractDefinition } from "./api_contract.js";
import { HttpMethodCallFunc,  } from './api_client_http_method_call.js';
import { HttpMethodEndpoint, IHttpMethodEndpointDefinition, ValidateHttpMethodEndpointDefinition } from './http_method_endpoint.js';
import { ClientHttpMethodEndpointHandler } from "./http_method_endpoint_handler.js";
import { HttpRequestObject } from "./http_method_endpoint_handler_input.js";

export function createClient<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>
> (
  contract: ApiContract<TDef>, 
  clientGenericHandler: ClientHttpMethodEndpointHandler
) {
  const apiClient = new ApiClient(contract, clientGenericHandler);
  return apiClient;
}

export type PathParamFunc<TDef> = (value: string | number) => TDef;

export interface IClientContext {
  pathParameters: Record<string, string>;
}

class InnerApiClient<TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>> {

  // TODO: if making __CONTEXT__ private member, the following compilation error occurs: 
  // "Property '__CONTEXT__' of exported anonymous class type may not be private or protected.ts(4094)"
  // Reason: exported anonymous classes can't have private or protected members if declaration emit is enabled
  // Source: https://stackoverflow.com/questions/55242196/typescript-allows-to-use-proper-multiple-inheritance-with-mixins-but-fails-to-c
  
  /** @internal */
  __CONTEXT__: IClientContext;

  constructor(contract: ApiContract<TDef>, clientGenericHandler: ClientHttpMethodEndpointHandler) {
    const initializedDefinition = contract.cloneInitDef();

    const proto = { ...InnerApiClient.prototype };
    Object.assign(proto, Object.getPrototypeOf(initializedDefinition));
    Object.setPrototypeOf(this, proto);
    Object.assign(this, initializedDefinition);

    InnerApiClient._initialize(this, this, clientGenericHandler);

    this.__CONTEXT__ = InnerApiClient._initNewContext();
  }

  private static _initNewContext(): IClientContext {
    return {
      pathParameters: {},
    };
  }

  private static _initialize<TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>>(
    client: InnerApiClient<TDef>,
    currObj: any, 
    clientGenericHandler: ClientHttpMethodEndpointHandler
  ): void {
    for (const key of Object.keys(currObj)) {
      if (key === '__CONTEXT__') {
        continue; // skip the context property
      }
      const val = currObj[key];
      if (key.startsWith(':')) {
        const paramName = key.slice(1);
        currObj[paramName] = ((value: string | number) => {
          client.__CONTEXT__.pathParameters[paramName] = value.toString();
          return val;
        });
        delete currObj[key];
        InnerApiClient._initialize(client, val, clientGenericHandler);
      } else if (val instanceof HttpMethodEndpoint) {
        currObj[key] = (requestObject: never | HttpRequestObject) => {
          const pathParams = { ...client.__CONTEXT__.pathParameters };
          
          // Clear & reinitialize client context right before making the call
          client.__CONTEXT__ = InnerApiClient._initNewContext(); 

          const headers = clientParseRequestDefinitionField(val.definition, 'headers', requestObject);
          const query = clientParseRequestDefinitionField(val.definition, 'query', requestObject);
          const body = clientParseRequestDefinitionField(val.definition, 'body', requestObject);

          const path = `/${val.pathSegments.map(segment => 
              segment.startsWith(':') 
              ? (pathParams[segment.slice(1)] ?? '?') 
              : segment
            ).join('/')}`;
            
          return clientGenericHandler({
            method: val.method,
            pathSegments: val.pathSegments,
            genericPath: val.genericPath,
            path,
            headers,
            pathParams,
            query,
            body,
          });
        };
      } else if (typeof val === 'object' && val !== null) {
        InnerApiClient._initialize(client, val, clientGenericHandler);
      }
    }
  }
}

export type ApiClientDef<ObjType extends object> = {
  [Key in keyof ObjType as Key extends `:${infer Param}` ? Param : Key]:
    Key extends `:${string}`
      ? ObjType[Key] extends object
        ? PathParamFunc<ApiClientDef<ObjType[Key]>>
        : never
      : ObjType[Key] extends HttpMethodEndpoint<infer TMethodEndpointDef>
        ? HttpMethodCallFunc<TMethodEndpointDef>
        : ObjType[Key] extends object
          ? ApiClientDef<ObjType[Key]>
          : ObjType[Key];
};

export type ApiClient<TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>> = Omit<ApiClientDef<InnerApiClient<TDef> & TDef>, "__CONTEXT__">;
export const ApiClient: new <TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>>(contract: ApiContract<TDef>, clientGenericHandler: ClientHttpMethodEndpointHandler) => ApiClient<TDef> = InnerApiClient as any;

function clientParseRequestDefinitionField<
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
        throw new Error(`'${key}' is required for this endpoint`);
      }
      return result.data;
    }
    const result = definition[key].safeParse(requestObject[key as keyof T]);
    if (!result.success) {
      throw new Error(`Validation for '${key}' failed`, { cause: result.error });
    }
    return result.data;
  }
  return null; // by design, if request object parts are not defined through schema, we set them to null
}