/**
 * Handler context types for the Congruent API framework.
 * 
 * These context types are designed to be extensible, allowing additional
 * properties to be added in the future without breaking changes to handler signatures.
 */

/**
 * Context for endpoint handlers (the final handler in the chain).
 * Does not include a 'next' function since endpoint handlers are terminal.
 * Includes all injected dependencies via the TInjected type parameter.
 */
export type EndpointHandlerContext<TInjected = {}> = {
  // Future properties can be added here
  // For now, this is an extensibility point
} & Readonly<TInjected>;

/**
 * Context for middleware handlers.
 * Includes a 'next' function to pass control to the next handler in the chain.
 * Includes all injected dependencies via the TInjected type parameter.
 */
export type MiddlewareHandlerContext<TInjected = {}> = {
  next: () => Promise<void>;
  // Future properties can be added here
} & Readonly<TInjected>;

/**
 * Context for decorator handlers.
 * Includes a 'next' function to pass control to the next handler in the chain.
 * Note: Decorators typically don't have injected dependencies directly,
 * as they are constructed with dependencies via their factory/create method.
 */
export type DecoratorHandlerContext = {
  next: () => Promise<void>;
  // Future properties can be added here
};
