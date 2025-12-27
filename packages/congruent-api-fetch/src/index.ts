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

const EMPTY_OBJECT = Object.freeze({});

export function createFetchClient<
  TDef extends IApiContractDefinition & ValidateApiContractDefinition<TDef>
> (
  contract: ApiContract<TDef>, 
  options: IFetchOptions
) {
  return createClient<TDef>(contract, async (input) => {
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(input.query ?? EMPTY_OBJECT)) {
      if (value !== undefined) {
        urlParams.append(key, String(value));
      }
    }
    const finalPath = Object.entries(input.pathParams ?? EMPTY_OBJECT).reduce((acc, [key, value]) => {
      return acc.replace(`:${key}`, encodeURIComponent(String(value)));
    }, input.path);
    const urlParamsString = urlParams.toString();
    const finalFullPath = finalPath + (urlParamsString ? `?${urlParamsString}` : '');
    const baseUrl = typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl;
    const fullUrlAddress = new URL(finalFullPath, baseUrl);
    // console.log(`Request: ${input.method} ${fullUrlAddress.toString()}`);
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
    const responseHeaders = Object.fromEntries(response.headers.entries());

    // TODO: Use a more robust check for empty body
    if (responseCode === HttpStatusCode.NoContent_204 
    || responseCode === HttpStatusCode.NotModified_304) {
      return {
        code: responseCode,
        headers: responseHeaders,
        body: undefined,
      };
    }

    const responseContentType = response.headers.get("content-type") || "";
    if (!responseContentType.includes("application/json")) {
      // console.error(`Response [${responseCode}]`, await response.text());
      throw new Error(`Expected 'application/json' content-type in response header, but got '${responseContentType}'`);
    }
    
    const responseBody = await response.json();
    return {
      code: responseCode,
      headers: responseHeaders,
      body: responseBody,
    };
  });
}

