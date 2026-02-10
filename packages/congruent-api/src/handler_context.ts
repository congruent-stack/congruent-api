declare const __overlap__error__: unique symbol;

export type EndpointHandlerContextOverlapGuard<TInjected> =
  // keep unknown in EndpointHandlerContext<unknown> to avoid distributing TInjected to all properties of EndpointHandlerContext
  // we are only interested in the properties of EndpointHandlerContext itself, not in the properties of TInjected 
  [Extract<keyof TInjected, keyof EndpointHandlerContext<unknown>>] extends [never]
    ? {} // ok: no overlap
    : { 
      [__overlap__error__]: `❌ ERROR: property "${Extract<keyof TInjected & keyof EndpointHandlerContext<unknown>, string>}" already part of Endpoint Context. Choose a different property name to avoid conflict.` 
    };

export type MiddlewareHandlerContextOverlapGuard<TInjected> =
  // keep unknown in MiddlewareHandlerContext<unknown> to avoid distributing TInjected to all properties of MiddlewareHandlerContext
  // we are only interested in the properties of MiddlewareHandlerContext itself, not in the properties of TInjected
  [Extract<keyof TInjected, keyof MiddlewareHandlerContext<unknown>>] extends [never]
    ? {} // ok: no overlap
    : { 
      [__overlap__error__]: `❌ ERROR: property "${Extract<keyof TInjected & keyof MiddlewareHandlerContext<unknown>, string>}" already part of Middleware Context. Choose a different property name to avoid conflict.` 
    };

export type MiddlewareHandlerContext<TInjected = {}> = {
  next: () => Promise<void>;
  // TODO: check congruent-api-express/src/index.ts
  // getHeader: (name: string) => string | number | readonly string[] | undefined;
  // setHeader: (name: string, value: string | number | readonly string[]) => void;
  // hasHeader: (name: string) => boolean;
  // removeHeader: (name: string) => void;
  originalRequest: any;
} & Readonly<TInjected>;

export type EndpointHandlerContext<TInjected = {}> = {
  originalRequest: any;
} & Readonly<TInjected>;

// this does not need a context overlap guard because decorators get their dependencies through constructor injection
export type DecoratorHandlerContext = {
  next: () => Promise<void>;
  originalRequest: any;
};
