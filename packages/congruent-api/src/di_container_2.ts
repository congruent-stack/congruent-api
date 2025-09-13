// This type ensures only string literals are accepted, not variables
type StringLiteral<T extends string> = string extends T ? never : T;

export type DILifetime = 'singleton' | 'transient' | 'scoped';

export type DIRegistryEntry<T> = {
  factory: (scope: any) => T;
  lifetime: DILifetime;
};

export type DIRegistry = Record<string, DIRegistryEntry<any>>;

export type DIScope<R extends DIRegistry> = {
  [K in keyof R as `get${Capitalize<string & K>}`]: () => R[K] extends DIRegistryEntry<infer T> ? T : never
};

export class DIContainer<R extends DIRegistry = {}> {
  private _map = new Map<string, DIRegistryEntry<any>>();

  public register<K extends string, T>(
    serviceNameLiteral: StringLiteral<K>,
    factory: (scope: DIScope<R>) => T,
    lifetime: DILifetime
  ): DIContainer<R & Record<K, DIRegistryEntry<T>>> {
    const entry: DIRegistryEntry<T> = { factory, lifetime };
    this._map.set(serviceNameLiteral, entry);
    return this as unknown as DIContainer<R & Record<K, DIRegistryEntry<T>>>;
  }

  public createScope(): DIScope<R> {
    const proxy = new Proxy({}, {
      get: (_target, prop: string) => {
        if (prop.startsWith('get')) {
          const serviceName = prop.slice(3);
          if (this._map.has(serviceName)) {
            return () => {
              const entry = this._map.get(serviceName);
              if (!entry) throw new Error(`Service not found: ${serviceName}`);
              return entry.factory(proxy);
            };
          } else {
            throw new Error(`Service not registered: ${serviceName}`);
          }
        }
        throw new Error(`Service not found: ${String(prop)}`);
      }
    });
    return proxy as DIScope<R>;
  }
}