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
});