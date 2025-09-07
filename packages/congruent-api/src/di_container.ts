type StringLiteral<S> = S extends string
  ? string extends S
    ? never
    : S
  : never;

// A helper type to represent a class constructor that creates an instance of type T.
export type DIClass<T> = new (...args: any[]) => T;

// Define the lifetime for dependency instances.
export type DILifetime = 'singleton' | 'transient' | 'scoped';

// Define the shape of a registration entry.
interface DIRegistration {
  factory: (container: any) => any;
  lifetime: DILifetime;
}

// A type to map service names (as strings) to their class types.
// e.g., { LoggerService: LoggerService, DatabaseService: DatabaseService }
type DIServiceRegistry = Record<string, any>;

/**
 * A scoped container that provides typed method access to services.
 */
export type DIScope<R extends DIServiceRegistry> = {
  [K in keyof R as `get${string & K}`]: () => R[K]
};

/**
 * This is the core of the static typing. It's a "mapped type" that takes a
 * ServiceRegistry `R` and creates a new type. For each key `K` in the registry,
 * it adds a method named `getK` that returns an instance of the corresponding service type.
 *
 * For example, if R is `{ LoggerService: LoggerService }`, this type will be:
 * { getLoggerService: () => LoggerService }
 */
type DITypedContainer<R extends DIServiceRegistry> = DIContainer<R> & {
  [K in keyof R as `get${string & K}`]: () => R[K]
};

/**
 * A Dependency Injection (DI) Container that provides static typing for resolved services.
 */
export class DIContainer<R extends DIServiceRegistry = {}> {
  private registry = new Map<string, DIRegistration>();
  private singletons = new Map<string, any>();
  private proxy: any;

  /**
   * The constructor returns a Proxy. This is the runtime magic that intercepts
   * calls to methods like `getLoggerService()`. It parses the method name,
   * finds the corresponding service class in the registry, and resolves it.
   */
  constructor() {
    // Store a reference to the proxy so we can use it in factory functions
    this.proxy = new Proxy(this, {
      get: (target, prop, receiver) => {
        // Intercept any property access that starts with "get".
        if (typeof prop === 'string' && prop.startsWith('get')) {
          // Extract the service name, e.g., "getLoggerService" -> "LoggerService".
          const serviceName = prop.substring(3);

          // Find the registered service by service name.
          if (target.registry.has(serviceName)) {
            // If found, return a function that resolves the service.
            return () => target.resolveByName(serviceName);
          } else {
            throw new Error(`Service not registered: ${serviceName}`);
          }
        }
        // For any other property (like 'register'), perform the default behavior.
        return Reflect.get(target, prop, receiver);
      }
    });
    
    return this.proxy as unknown as DITypedContainer<R>;
  }

  /**
   * Registers a service with explicit service name (fully type-safe).
   */
  public register<T, N extends string>(
    serviceNameLiteral: StringLiteral<N>,
    factory: (container: DITypedContainer<R>) => T,
    lifetime: DILifetime = 'transient'
  ): DITypedContainer<R & Record<N, T>> {
    this.registry.set(serviceNameLiteral, { factory, lifetime });
    return this as unknown as DITypedContainer<R & Record<N, T>>;
  }

  /**
   * Resolves a service by service name.
   */
  private resolveByName<T>(serviceName: string): T {
    const registration = this.registry.get(serviceName);

    if (!registration) {
      throw new Error(`Service not registered: ${serviceName}`);
    }

    if (registration.lifetime === 'singleton') {
      if (!this.singletons.has(serviceName)) {
        // The factory is called with the proxy container,
        // allowing dependencies to be resolved using the `get...` syntax.
        const instance = registration.factory(this.proxy);
        this.singletons.set(serviceName, instance);
      }
      return this.singletons.get(serviceName);
    }

    return registration.factory(this.proxy);
  }

  /**
   * Creates a scoped container with typed method access to services.
   */
  public createScope(): DIScope<R> {
    const scope = {} as any;
    
    return new Proxy(scope, {
      get: (target, prop) => {
        // Intercept any method call that starts with "get".
        if (typeof prop === 'string' && prop.startsWith('get')) {
          // Extract the service name, e.g., "getPokemonSvc" -> "PokemonSvc".
          const serviceName = prop.substring(3);
          
          // Find the registered service by service name.
          if (this.registry.has(serviceName)) {
            const registration = this.registry.get(serviceName);
            
            // Return a function that resolves the service
            return () => {
              // For transient services, always create new instances
              if (registration?.lifetime === 'transient') {
                return this.resolveByName(serviceName);
              }
              
              // For singleton/scoped services, cache in the scope
              const cacheKey = `_cached_${serviceName}`;
              if (!target[cacheKey]) {
                target[cacheKey] = this.resolveByName(serviceName);
              }
              return target[cacheKey];
            };
          } else {
            throw new Error(`Service not registered: ${serviceName}`);
          }
        }
        
        // For any other property, perform the default behavior.
        return Reflect.get(target, prop);
      }
    }) as DIScope<R>;
  }

  createTestClone(): this {
    const clone = new DIContainer<R>();
    return clone as this;
  }
}