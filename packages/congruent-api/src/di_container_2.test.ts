import { expect, test, describe } from 'vitest';
import { DIContainer } from './di_container_2';

describe('DIContainer 2', () => {
  test('should register and resolve services', () => {
    class FooService {
    }

    class BarService {
      constructor(private fooService: FooService) {}
    }

    class BazService {
      constructor(private barService: BarService) {}
    }
    
    const container = new DIContainer()
      .register('FooService', (scope) => {
        return new FooService();
      }, 'transient')
      .register('BarService', (scope) => {
        return new BarService(scope.getFooService());
      }, 'transient')
      .register('BazService', (scope) => {
        return new BazService(scope.getBarService());
      }, 'transient');

    const scope = container.createScope();

    const bazService = scope.getBazService();
    const barService = scope.getBarService();
    const fooService = scope.getFooService();
    
    expect(fooService).toBeInstanceOf(FooService);
    expect(barService).toBeInstanceOf(BarService);
    expect(bazService).toBeInstanceOf(BazService);
  });
});