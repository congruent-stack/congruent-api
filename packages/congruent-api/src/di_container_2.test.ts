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
});