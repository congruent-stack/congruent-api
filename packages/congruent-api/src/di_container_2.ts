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
  private _singletonInstances = new Map<string, any>();

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
    const proxy = new Proxy({
      _map: this._map,
      _singletonInstances: this._singletonInstances,
      _scopedInstances: new Map<string, any>(),
    }, {
      get: (target, prop: string) => {
        if (prop.startsWith('get')) {
          const serviceName = prop.slice(3);
          if (target._map.has(serviceName)) {
            const entry = target._map.get(serviceName)!;
            switch (entry.lifetime) {
              case 'transient':
                return () => entry.factory(proxy);
              case 'scoped':
                return () => {
                  if (!target._scopedInstances.has(serviceName)) {
                    const instance = entry.factory(proxy);
                    target._scopedInstances.set(serviceName, instance);
                  }
                  return target._scopedInstances.get(serviceName);
                };
              case 'singleton':
                return () => {
                  if (!target._singletonInstances.has(serviceName)) {
                    const instance = entry.factory(proxy);
                    target._singletonInstances.set(serviceName, instance);
                  }
                  return target._singletonInstances.get(serviceName);
                };
            }
            // throw new Error(`Unsupported lifetime: ${entry.lifetime}`);
          } else {
            throw new Error(`Service not registered: ${serviceName}`);
          }
        }
        throw new Error(`Service not found: ${String(prop)}`);
      }
    });
    return proxy as unknown as DIScope<R>;
  }
}