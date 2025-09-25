// // This ensures only string literals are accepted, not variables
export type StringLiteral<T extends string> = string extends T ? never : T;

// Accept only *capitalized* string *literals* (e.g., "Foo", "BarBaz").
// Rejects non-literals (plain `string`) and strings not starting with an uppercase letter.
export type CapitalizedStringLiteral<T extends string> =
  string extends T
    ? never      // not a concrete literal
    : T extends `${Uppercase<infer F>}${infer _}`
      ? F extends Lowercase<F> 
        ? never  // F is not uppercase
        : T      // F must be a letter and uppercase
      : `❌ ERROR: Must start with uppercase letter`;

export type DILifetime = 'singleton' | 'transient' | 'scoped';

export type DIRegistryEntry<T> = {
  factory: (scope: any) => T;
  lifetime: DILifetime;
};

export type DIRegistry = Record<string, DIRegistryEntry<any>>;

export type DIScope<R extends DIRegistry> = {
  [K in keyof R as `get${string & K}`]: () => R[K] extends DIRegistryEntry<infer T> ? T : never
};

export class DIContainerBase<R extends DIRegistry> {
  protected _map = new Map<string, DIRegistryEntry<any>>();
  protected _singletonInstances = new Map<string, any>();

  public createScope(): DIScope<R> {
    const proxy = new Proxy({
      _map: this._map,
      _singletonInstances: this._singletonInstances,
      _scopedInstances: new Map<string, any>(),
      _isBuildingSingleton: false,
    }, {
      get: (target, prop: string) => {
        if (prop.startsWith('get')) {
          const serviceName = prop.slice(3);
          if (target._map.has(serviceName)) {
            const entry = target._map.get(serviceName)!;
            switch (entry.lifetime) {
              case 'transient':
                return () => {
                  if (target._isBuildingSingleton) {
                    throw new Error(`Cannot resolve transient service '${serviceName}' while building a singleton`);
                  }
                  return entry.factory(proxy)
                };
              case 'scoped':
                return () => {
                  if (target._isBuildingSingleton) {
                    throw new Error(`Cannot resolve scoped service '${serviceName}' while building a singleton`);
                  }
                  if (!target._scopedInstances.has(serviceName)) {
                    const instance = entry.factory(proxy);
                    target._scopedInstances.set(serviceName, instance);
                  }
                  return target._scopedInstances.get(serviceName);
                };
              case 'singleton':
                return () => {
                  if (!target._singletonInstances.has(serviceName)) {
                    target._isBuildingSingleton = true;
                    try {
                      const instance = entry.factory(proxy);
                      target._singletonInstances.set(serviceName, instance);
                    } finally {
                      target._isBuildingSingleton = false;
                    }
                  }
                  return target._singletonInstances.get(serviceName);
                };
              default:
                throw new Error(`Unsupported lifetime: ${entry.lifetime}`);
            }
          } else {
            throw new Error(`Service not registered: ${serviceName}`);
          }
        }
        throw new Error(`Property access denied by Proxy: ${String(prop)}`);
      }
    });
    return proxy as unknown as DIScope<R>;
  }
}

export class DIContainer<R extends DIRegistry = {}> extends DIContainerBase<R> {
  public register<K extends string, T>(
    serviceNameCapitalizedLiteral: CapitalizedStringLiteral<K>,
    factory: (scope: DIScope<R>) => T,
    lifetime: DILifetime
  ): DIContainer<R & Record<K, DIRegistryEntry<T>>> {
    const entry: DIRegistryEntry<T> = { factory, lifetime };
    this._map.set(serviceNameCapitalizedLiteral, entry);
    return this as unknown as DIContainer<R & Record<K, DIRegistryEntry<T>>>;
  }

  createTestClone(): DIContainerTestClone<R, this> {
    return new DIContainerTestClone(this);
  }
}

export class DIContainerTestClone<R extends DIRegistry, TDIContainer extends DIContainer<R>> extends DIContainerBase<R> {
  constructor(original: TDIContainer) {
    super();
    original['_map'].forEach((value: DIRegistryEntry<any>, key: string) => {
      this._map.set(key, {
        factory: (_scope: DIScope<R>) => { throw new Error(`Service registration not overridden: ${key}`); },
        lifetime: value.lifetime,
      });
    });
  }

  override<K extends keyof R & string>(
    serviceNameLiteral: K,
    factory: (scope: DIScope<R>) => R[K] extends DIRegistryEntry<infer T> ? T : never
  ): this {
    const registration = this._map.get(serviceNameLiteral);
    if (!registration) {
      throw new Error(`Service not registered: ${serviceNameLiteral}`);
    }
    this._map.set(serviceNameLiteral, { factory, lifetime: registration.lifetime });
    return this;
  }
}