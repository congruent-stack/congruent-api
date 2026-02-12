import {
  HttpStatusCode, 
  type IApiContractDefinition, 
  ApiContract,
  ValidateApiContractDefinition,
  createClient,
  ClientHttpMethodEndpointHandlerInput,
  RequestFailureCode,
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
    let response: Response;
    try {
      response = await fetch(fullUrlAddress, finalRequestInit);
    } catch (error) {
      return {
        code: RequestFailureCode.ErrorThrown,
        body: error instanceof Error ? error : new Error(String(error)),
      }
    }
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

    // const responseContentType = response.headers.get("content-type") || "";
    // if (!responseContentType.includes("application/json")) {
    //   throw new Error(`Expected 'application/json' in 'content-type' response header, but got '${responseContentType}'`);
    // }
    
    let responseBody: any;
    try {
      responseBody = await response.json();
    } catch (error) {
      return {
        code: RequestFailureCode.ErrorThrown,
        body: error instanceof Error ? error : new Error(String(error)),
      }
    }
    return {
      code: responseCode,
      headers: responseHeaders,
      body: responseBody,
    };
  });
}

