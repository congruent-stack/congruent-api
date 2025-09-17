import { expect, test, describe } from 'vitest';
import { DIContainer } from './di_container_2';

describe('DIContainer 2', () => {
  test('should register and resolve transient services', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
    }

    class BarService {
      public readonly uuid = crypto.randomUUID();
      constructor(public fooService: FooService) {}
    }

    class BazService {
      public readonly uuid = crypto.randomUUID();
      constructor(public barService: BarService) {}
    }
    
    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'transient')
      .register('BarService', (scope) => new BarService(scope.getFooService()), 'transient')
      .register('BazService', (scope) => new BazService(scope.getBarService()), 'transient');

    const scope = container.createScope();

    const bazService = scope.getBazService();
    const barService = scope.getBarService();
    const fooService = scope.getFooService();
    
    expect(fooService).toBeInstanceOf(FooService);
    expect(barService).toBeInstanceOf(BarService);
    expect(bazService).toBeInstanceOf(BazService);

    expect(fooService.uuid).not.toBe(barService.fooService.uuid);
    expect(fooService.uuid).not.toBe(bazService.barService.fooService.uuid);

    expect(barService.uuid).not.toBe(bazService.barService.uuid);
  });

  test('should register and resolve scoped services', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
      public foo(): string { return 'foo'; }
    }

    class BarService {
      public readonly uuid = crypto.randomUUID();
      constructor(public fooService: FooService) {}
      public bar(): string { return this.fooService.foo() + 'bar'; }
    }

    class BazService {
      public readonly uuid = crypto.randomUUID();
      constructor(public barService: BarService) {}
      public baz(): string { return this.barService.bar() + 'baz'; }
    }
    
    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'scoped')
      .register('BarService', (scope) => new BarService(scope.getFooService()), 'scoped')
      .register('BazService', (scope) => new BazService(scope.getBarService()), 'scoped');

    const scope = container.createScope();

    const bazService = scope.getBazService();
    const barService = scope.getBarService();
    const fooService = scope.getFooService();

    expect(fooService).toBeInstanceOf(FooService);
    expect(barService).toBeInstanceOf(BarService);
    expect(bazService).toBeInstanceOf(BazService);

    expect(fooService.uuid).toBe(barService.fooService.uuid);
    expect(fooService.uuid).toBe(bazService.barService.fooService.uuid);

    expect(barService.uuid).toBe(bazService.barService.uuid);
  });

  test('should register and resolve singleton services', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
    }

    class BarService {
      public readonly uuid = crypto.randomUUID();
      constructor(public fooService: FooService) {}
    }

    class BazService {
      public readonly uuid = crypto.randomUUID();
      constructor(public barService: BarService) {}
    }
    
    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'singleton')
      .register('BarService', (scope) => new BarService(scope.getFooService()), 'singleton')
      .register('BazService', (scope) => new BazService(scope.getBarService()), 'singleton');

    const scope = container.createScope();

    const bazService = scope.getBazService();
    const barService = scope.getBarService();
    const fooService = scope.getFooService();

    expect(fooService).toBeInstanceOf(FooService);
    expect(barService).toBeInstanceOf(BarService);
    expect(bazService).toBeInstanceOf(BazService);
    
    expect(fooService.uuid).toBe(barService.fooService.uuid);
    expect(fooService.uuid).toBe(bazService.barService.fooService.uuid);

    expect(barService.uuid).toBe(bazService.barService.uuid);
  });

  test('container test clone should allow overriding service registrations', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
      public foo(): string { return 'foo'; }
    }

    class BarService {
      public readonly uuid = crypto.randomUUID();
      constructor(public fooService: FooService) {}
      public bar(): string { return this.fooService.foo() + '-bar'; }
    }

    class BazService {
      public readonly uuid = crypto.randomUUID();
      constructor(public barService: BarService) {}
      public baz(): string { return this.barService.bar() + '-baz'; }
    }

    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'transient')
      .register('BarService', (scope) => new BarService(scope.getFooService()), 'transient')
      .register('BazService', (scope) => new BazService(scope.getBarService()), 'transient');

    const scope = container.createScope();

    const bazService = scope.getBazService();
    const barService = scope.getBarService();
    const fooService = scope.getFooService();

    expect(fooService).toBeInstanceOf(FooService);
    expect(barService).toBeInstanceOf(BarService);
    expect(bazService).toBeInstanceOf(BazService);

    expect(fooService.foo()).toBe('foo');
    expect(barService.bar()).toBe('foo-bar');
    expect(bazService.baz()).toBe('foo-bar-baz');

    class FakeBazService {
      public readonly uuid = crypto.randomUUID();
      constructor(public barService: BarService) {}
      public baz(): string { return this.barService.bar() + '-TEST-baz'; }
    }

    const testContainer = container.createTestClone()
      .override('FooService', () => ({
        uuid: crypto.randomUUID(),
        foo: () => 'TEST-foo',
      }))
      .override("BarService", (scope) => {
        const fooService = scope.getFooService();
        return ({
          uuid: crypto.randomUUID(),
          fooService,
          bar: () => fooService.foo() + '-TEST-bar',
        });
      })
      .override('BazService', (scope) => new FakeBazService(scope.getBarService()));

    const testScope = testContainer.createScope();

    const testBazService = testScope.getBazService();
    const testBarService = testScope.getBarService();
    const testFooService = testScope.getFooService();

    expect(testFooService).not.toBeInstanceOf(FooService);
    expect(testBarService).not.toBeInstanceOf(BarService);
    expect(testBazService).not.toBeInstanceOf(BazService);

    expect(testFooService.foo()).toBe('TEST-foo');
    expect(testBarService.bar()).toBe('TEST-foo-TEST-bar');
    expect(testBazService.baz()).toBe('TEST-foo-TEST-bar-TEST-baz');
  });

  test('container test clone should throw error while not overriden service is resolving', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
      public foo(): string { return 'foo'; }
    }

    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'transient');

    const testContainer = container.createTestClone();

    const testScope = testContainer.createScope();

    expect(() => testScope.getFooService()).toThrowError("Service registration not overridden: FooService");
  });

  test('singleton services should be shared across scopes', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
    }

    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'singleton');

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const fooService1 = scope1.getFooService();
    const fooService2 = scope2.getFooService();

    expect(fooService1).toBeInstanceOf(FooService);
    expect(fooService2).toBeInstanceOf(FooService);
    expect(fooService1).toBe(fooService2);
    expect(fooService1.uuid).toBe(fooService2.uuid);
  });

  test('scoped services should be unique per scope', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
    }

    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'scoped');

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const fooService1 = scope1.getFooService();
    const fooService2 = scope2.getFooService();

    expect(fooService1).toBeInstanceOf(FooService);
    expect(fooService2).toBeInstanceOf(FooService);
    expect(fooService1).not.toBe(fooService2);
    expect(fooService1.uuid).not.toBe(fooService2.uuid);
  });

  test('transient services should be unique per resolution', () => {
    class FooService {
      public readonly uuid = crypto.randomUUID();
    }

    const container = new DIContainer()
      .register('FooService', () => new FooService(), 'transient');

    const scope = container.createScope();

    const fooService1 = scope.getFooService();
    const fooService2 = scope.getFooService();

    expect(fooService1).toBeInstanceOf(FooService);
    expect(fooService2).toBeInstanceOf(FooService);
    expect(fooService1).not.toBe(fooService2);
    expect(fooService1.uuid).not.toBe(fooService2.uuid);
  });

  test('singleton services should be shared across scopes, while scoped services should be unique per scope, while transient services should be unique per resolution', () => {
    class SingletonService {
      public readonly uuid = crypto.randomUUID();
    }

    class ScopedService {
      public readonly uuid = crypto.randomUUID();
    }

    class TransientService {
      public readonly uuid = crypto.randomUUID();
    }

    const container = new DIContainer()
      .register('SingletonService', () => new SingletonService(), 'singleton')
      .register('ScopedService', () => new ScopedService(), 'scoped')
      .register('TransientService', () => new TransientService(), 'transient');

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const singleton1A = scope1.getSingletonService();
    const singleton1B = scope1.getSingletonService();
    const singleton2A = scope2.getSingletonService();
    const singleton2B = scope2.getSingletonService();

    expect(singleton1A).toBe(singleton1B);
    expect(singleton1A).toBe(singleton2A);
    expect(singleton1A).toBe(singleton2B);
    expect(singleton2A).toBe(singleton2B);
    expect(singleton1A.uuid).toBe(singleton2A.uuid);
    expect(singleton1A.uuid).toBe(singleton1B.uuid);
    expect(singleton2A.uuid).toBe(singleton2B.uuid);
    expect(singleton1B.uuid).toBe(singleton2B.uuid);

    const scoped1A = scope1.getScopedService();
    const scoped1B = scope1.getScopedService();
    const scoped2A = scope2.getScopedService();
    const scoped2B = scope2.getScopedService();

    expect(scoped1A).toBe(scoped1B);
    expect(scoped2A).toBe(scoped2B);
    expect(scoped1A).not.toBe(scoped2A);
    expect(scoped1A).not.toBe(scoped2B);
    expect(scoped1A.uuid).toBe(scoped1B.uuid);
    expect(scoped2A.uuid).toBe(scoped2B.uuid);
    expect(scoped1A.uuid).not.toBe(scoped2A.uuid);
    expect(scoped1B.uuid).not.toBe(scoped2B.uuid);

    const transient1A = scope1.getTransientService();
    const transient1B = scope1.getTransientService();
    const transient2A = scope2.getTransientService();
    const transient2B = scope2.getTransientService();

    expect(transient1A).not.toBe(transient1B);
    expect(transient1A).not.toBe(transient2A);
    expect(transient1A).not.toBe(transient2B);
    expect(transient1B).not.toBe(transient2A);
    expect(transient1B).not.toBe(transient2B);
    expect(transient2A).not.toBe(transient2B);
    expect(transient1A.uuid).not.toBe(transient1B.uuid);
    expect(transient1A.uuid).not.toBe(transient2A.uuid);
    expect(transient1A.uuid).not.toBe(transient2B.uuid);
    expect(transient1B.uuid).not.toBe(transient2A.uuid);
    expect(transient1B.uuid).not.toBe(transient2B.uuid);
    expect(transient2A.uuid).not.toBe(transient2B.uuid);
  });

  test('transient services should be able to depend on scoped and singleton services', () => {
    class SingletonService {
      public readonly uuid = crypto.randomUUID();
    }

    class ScopedService {
      public readonly uuid = crypto.randomUUID();
    }

    class TransientService {
      public readonly uuid = crypto.randomUUID();
      constructor(public singletonService: SingletonService, public scopedService: ScopedService) {}
    }

    const container = new DIContainer()
      .register('SingletonService', () => new SingletonService(), 'singleton')
      .register('ScopedService', () => new ScopedService(), 'scoped')
      .register('TransientService', (scope) => new TransientService(scope.getSingletonService(), scope.getScopedService()), 'transient');

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const transient1A = scope1.getTransientService();
    const transient1B = scope1.getTransientService();
    const transient2A = scope2.getTransientService();
    const transient2B = scope2.getTransientService();

    expect(transient1A).not.toBe(transient1B);
    expect(transient1A).not.toBe(transient2A);
    expect(transient1A).not.toBe(transient2B);
    expect(transient1B).not.toBe(transient2A);
    expect(transient1B).not.toBe(transient2B);
    expect(transient2A).not.toBe(transient2B);
    expect(transient1A.uuid).not.toBe(transient1B.uuid);
    expect(transient1A.uuid).not.toBe(transient2A.uuid);
    expect(transient1A.uuid).not.toBe(transient2B.uuid);
    expect(transient1B.uuid).not.toBe(transient2A.uuid);
    expect(transient1B.uuid).not.toBe(transient2B.uuid);
    expect(transient2A.uuid).not.toBe(transient2B.uuid);

    expect(transient1A.singletonService).toBe(transient1B.singletonService);
    expect(transient1A.singletonService).toBe(transient2A.singletonService);
    expect(transient1A.singletonService).toBe(transient2B.singletonService);
    expect(transient1B.singletonService).toBe(transient2A.singletonService);
    expect(transient1B.singletonService).toBe(transient2B.singletonService);
    expect(transient2A.singletonService).toBe(transient2B.singletonService);
    expect(transient1A.singletonService.uuid).toBe(transient2A.singletonService.uuid);
    expect(transient1B.singletonService.uuid).toBe(transient2B.singletonService.uuid);
    expect(transient1A.singletonService.uuid).toBe(transient1B.singletonService.uuid);
    expect(transient2A.singletonService.uuid).toBe(transient2B.singletonService.uuid);
    expect(transient1A.singletonService.uuid).toBe(transient2B.singletonService.uuid);

    expect(transient1A.scopedService).toBe(transient1B.scopedService);
    expect(transient1A.scopedService).not.toBe(transient2A.scopedService);
    expect(transient1A.scopedService).not.toBe(transient2B.scopedService);
    expect(transient1B.scopedService).not.toBe(transient2A.scopedService);
    expect(transient1B.scopedService).not.toBe(transient2B.scopedService);
    expect(transient2A.scopedService).toBe(transient2B.scopedService);
    expect(transient1A.scopedService.uuid).toBe(transient1B.scopedService.uuid);
    expect(transient2A.scopedService.uuid).toBe(transient2B.scopedService.uuid);
    expect(transient1A.scopedService.uuid).not.toBe(transient2A.scopedService.uuid);
    expect(transient1B.scopedService.uuid).not.toBe(transient2B.scopedService.uuid);

    expect(transient1A.scopedService).not.toBe(transient1A.singletonService);
    expect(transient1B.scopedService).not.toBe(transient1B.singletonService);
    expect(transient2A.scopedService).not.toBe(transient2A.singletonService);
    expect(transient2B.scopedService).not.toBe(transient2B.singletonService);
    expect(transient1A.scopedService.uuid).not.toBe(transient1A.singletonService.uuid);
    expect(transient1B.scopedService.uuid).not.toBe(transient1B.singletonService.uuid);
    expect(transient2A.scopedService.uuid).not.toBe(transient2A.singletonService.uuid);
    expect(transient2B.scopedService.uuid).not.toBe(transient2B.singletonService.uuid);
  });

  test('scoped services should be able to depend on singleton services, while transient dependencies should remain unique per resolution', () => {
    class SingletonService {
      public readonly uuid = crypto.randomUUID();
    }

    class ScopedService {
      public readonly uuid = crypto.randomUUID();
      constructor(public singletonService: SingletonService, public transientService: TransientService) {}
    }

    class AnotherScopedService {
      constructor(public transientService: TransientService) {}
    }

    class TransientService {
      public readonly uuid = crypto.randomUUID();
    }

    const container = new DIContainer()
      .register('SingletonService', () => new SingletonService(), 'singleton')
      .register('TransientService', () => new TransientService(), 'transient')
      .register('ScopedService', (scope) => new ScopedService(scope.getSingletonService(), scope.getTransientService()), 'scoped')
      .register('AnotherScopedService', (scope) => new AnotherScopedService(scope.getTransientService()), 'scoped');

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const scoped1A = scope1.getScopedService();
    const scoped1B = scope1.getScopedService();
    const scoped2A = scope2.getScopedService();
    const scoped2B = scope2.getScopedService();

    expect(scoped1A).toBe(scoped1B);
    expect(scoped2A).toBe(scoped2B);
    expect(scoped1A).not.toBe(scoped2A);
    expect(scoped1A).not.toBe(scoped2B);
    expect(scoped1A.uuid).toBe(scoped1B.uuid);
    expect(scoped2A.uuid).toBe(scoped2B.uuid);
    expect(scoped1A.uuid).not.toBe(scoped2A.uuid);
    expect(scoped1B.uuid).not.toBe(scoped2B.uuid);

    expect(scoped1A.singletonService).toBe(scoped1B.singletonService);
    expect(scoped1A.singletonService).toBe(scoped2A.singletonService);
    expect(scoped1A.singletonService).toBe(scoped2B.singletonService);
    expect(scoped1A.singletonService.uuid).toBe(scoped1B.singletonService.uuid);
    expect(scoped1A.singletonService.uuid).toBe(scoped2A.singletonService.uuid);
    expect(scoped1A.singletonService.uuid).toBe(scoped2B.singletonService.uuid);

    expect(scoped1A.transientService).not.toBe(scoped2A.transientService);
    expect(scoped1A.transientService).not.toBe(scoped2B.transientService);

    const anotherScoped1 = scope1.getAnotherScopedService();

    // This is the key check: two different services in the SAME scope
    // get different instances of a transient dependency.
    expect(scoped1A.transientService).not.toBe(anotherScoped1.transientService);
  });

  test('singleton services should not be able to depend on scoped or transient services', () => {
    class SingletonService {
      public readonly uuid = crypto.randomUUID();
      constructor(public scopedService: ScopedService) {}
    }

    class ScopedService {
      public readonly uuid = crypto.randomUUID();
    }

    class AnotherSingletonService {
      constructor(public transientService: TransientService) {}
    }

    class TransientService {
      public readonly uuid = crypto.randomUUID();
    }

    class YetAnotherSingletonService {
      constructor(public scopedService: ScopedService, public transientService: TransientService) {}
    }

    const container = new DIContainer()
      .register('ScopedService', () => new ScopedService(), 'scoped')
      .register('SingletonService', (scope) => new SingletonService(scope.getScopedService()), 'singleton')
      .register('TransientService', () => new TransientService(), 'transient')
      .register('AnotherSingletonService', (scope) => new AnotherSingletonService(scope.getTransientService()), 'singleton')
      .register('YetAnotherSingletonService', (scope) => new YetAnotherSingletonService(scope.getScopedService(), scope.getTransientService()), 'singleton');

    const scope = container.createScope();

    // const singletonService = scope.getSingletonService();

    expect(() => scope.getSingletonService()).toThrowError(/Cannot resolve/);
    expect(() => scope.getAnotherSingletonService()).toThrowError(/Cannot resolve/);
    expect(() => scope.getYetAnotherSingletonService()).toThrowError(/Cannot resolve/);
  });
});