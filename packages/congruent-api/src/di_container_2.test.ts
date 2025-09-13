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
});