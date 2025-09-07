import {
  HttpStatusCode, 
  type IApiContractDefinition, 
  ApiContract,
  ValidateApiContractDefinition,
  createClient,
  ClientHttpMethodEndpointHandlerInput,
} from '@congruent-stack/congruent-api';

export interface IFetchOptions {
  baseUrl: string | (() => string);
  enhanceRequestInit?: (reqInit: RequestInit, input: ClientHttpMethodEndpointHandlerInput) => RequestInit;
}

export function createFetchClient<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>
> (
  contract: ApiContract<TDef>, 
  options: IFetchOptions
) {
  return createClient<TDef>(contract, async (input) => {
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== undefined) {
        urlParams.append(key, String(value));
      }
    }
    const finalPath = Object.entries(input.pathParams ?? {}).reduce((acc, [key, value]) => {
      return acc.replace(`:${key}`, encodeURIComponent(String(value)));
    }, input.path);
    const urlParamsString = urlParams.toString();
    const finalFullPath = finalPath + (urlParamsString ? `?${urlParamsString}` : '');
    const baseUrl = typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl;
    const fullUrlAddress = new URL(finalFullPath, baseUrl);
    const requestInit: RequestInit = {
      method: input.method,
      headers: { 
        'Content-Type': 'application/json', // if this is not set, the server might not understand the request body
        ...input.headers
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    };
    const finalRequestInit = options.enhanceRequestInit
      ? options.enhanceRequestInit(requestInit, input)
      : requestInit;
    const response = await fetch(fullUrlAddress, finalRequestInit);
    const responseCode = response.status as HttpStatusCode;
    const responseBody = responseCode === HttpStatusCode.NoContent_204 // TODO: Use a more robust check for empty body
      ? undefined 
      : await response.json();
    return {
      code: responseCode,
      body: responseBody,
    };
  });
}

