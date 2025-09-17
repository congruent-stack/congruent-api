// import { expect, test, describe } from 'vitest';
// import { DIContainer } from './di_container';

// describe('DIContainer', () => {
//   class SomeService {
//     public readonly uuid: string;
//     constructor() {
//       this.uuid = crypto.randomUUID();
//     }
//   }

//   class SomeOtherService {
//     public readonly uuid: string;
//     public readonly someService: SomeService;
//     constructor(someService: SomeService) {
//       this.uuid = crypto.randomUUID();
//       this.someService = someService;
//     }
//   }

//   test('should create singleton service only once', () => {
//     const dicontainer = new DIContainer()
//       .register('SomeService', () => new SomeService(), 'singleton');

//     const scope = dicontainer.createScope();

//     const instance1 = scope.getSomeService();
//     const instance2 = scope.getSomeService();

//     expect(instance1).toBe(instance2);
//     expect(instance1.uuid).toBe(instance2.uuid);
//   });

//   test('should create transient service every time', () => {
//     const dicontainer = new DIContainer()
//       .register('SomeService', () => new SomeService(), 'transient');

//     const scope = dicontainer.createScope();

//     const instance1 = scope.getSomeService();
//     const instance2 = scope.getSomeService();
//     const instance3 = scope.getSomeService();

//     expect(instance1).not.toBe(instance2);
//     expect(instance1.uuid).not.toBe(instance2.uuid);
//     expect(instance2).not.toBe(instance3);
//     expect(instance2.uuid).not.toBe(instance3.uuid);
//     expect(instance1).not.toBe(instance3);
//     expect(instance1.uuid).not.toBe(instance3.uuid);
//   });

//   test('should create scoped service once per scope', () => {
//     const dicontainer = new DIContainer()
//       .register('SomeService', () => new SomeService(), 'scoped');

//     const scope1 = dicontainer.createScope();
//     const scope2 = dicontainer.createScope();
    
//     const instance1 = scope1.getSomeService();
//     const instance2 = scope1.getSomeService();
//     const instance3 = scope2.getSomeService();
//     const instance4 = scope2.getSomeService();

//     expect(instance1).toBe(instance2);
//     expect(instance1.uuid).toBe(instance2.uuid);

//     expect(instance3).toBe(instance4);
//     expect(instance3.uuid).toBe(instance4.uuid);

//     expect(instance1).not.toBe(instance3);
//     expect(instance1.uuid).not.toBe(instance3.uuid);

//     expect(instance2).not.toBe(instance4);
//     expect(instance2.uuid).not.toBe(instance4.uuid);

//     expect(instance1.uuid).not.toBe(instance4.uuid);
//     expect(instance2.uuid).not.toBe(instance3.uuid);
//   });

//   test('scoped service can depend on other scoped services', () => {
//     const dicontainer = new DIContainer()
//       .register('SomeService', () => new SomeService(), 'scoped')
//       .register('SomeOtherService', (c) => new SomeOtherService(c.getSomeService()), 'scoped');

//     const scope = dicontainer.createScope();

//     const someService1 = scope.getSomeService();
//     const someService2 = scope.getSomeService();
//     const someOtherService1 = scope.getSomeOtherService();
//     const someOtherService2 = scope.getSomeOtherService();

//     expect(someService1).toBe(someService2);
//     expect(someService1.uuid).toBe(someService2.uuid);

//     expect(someOtherService1).toBe(someOtherService2);
//     expect(someOtherService1.uuid).toBe(someOtherService2.uuid);

//     expect(someOtherService1.someService).toBe(someService1);
//     expect(someOtherService1.someService.uuid).toBe(someService1.uuid);

//     expect(someOtherService2.someService).toBe(someService1);
//     expect(someOtherService2.someService.uuid).toBe(someService1.uuid);

//     expect(someOtherService1.someService).toBe(someOtherService2.someService);
//     expect(someOtherService1.someService.uuid).toBe(someOtherService2.someService.uuid);

//     expect(someService1).not.toBe(someOtherService1);
//     expect(someService1.uuid).not.toBe(someOtherService1.uuid);
//     expect(someService1).not.toBe(someOtherService2);
//     expect(someService1.uuid).not.toBe(someOtherService2.uuid);
//     expect(someService2).not.toBe(someOtherService1);
//     expect(someService2.uuid).not.toBe(someOtherService1.uuid);
//     expect(someService2).not.toBe(someOtherService2);
//     expect(someService2.uuid).not.toBe(someOtherService2.uuid);
    
//   });

//   test('should share singleton services across different scopes', () => {
//     const dicontainer = new DIContainer()
//       .register('SomeService', () => new SomeService(), 'singleton');

//     const scope1 = dicontainer.createScope();
//     const scope2 = dicontainer.createScope();

//     const instance1 = scope1.getSomeService();
//     const instance2 = scope2.getSomeService();

//     expect(instance1).toBe(instance2);
//     expect(instance1.uuid).toBe(instance2.uuid);
//   });

//   test('should handle mixed service lifetimes correctly', () => {
//     const dicontainer = new DIContainer()
//       .register('SingletonService', () => new SomeService(), 'singleton')
//       .register('ScopedService', () => new SomeService(), 'scoped')
//       .register('TransientService', () => new SomeService(), 'transient');

//     const scope1 = dicontainer.createScope();
//     const scope2 = dicontainer.createScope();

//     // Singleton should be same across scopes
//     expect(scope1.getSingletonService()).toBe(scope2.getSingletonService());

//     // Scoped should be different across scopes
//     expect(scope1.getScopedService()).not.toBe(scope2.getScopedService());

//     // Transient should be different every time
//     expect(scope1.getTransientService()).not.toBe(scope1.getTransientService());
//     expect(scope2.getTransientService()).not.toBe(scope2.getTransientService());
//   });

//   test('should throw error when trying to resolve unregistered service', () => {
//     const dicontainer = new DIContainer();
//     const scope = dicontainer.createScope();

//     expect(() => {
//       (scope as any).getUnregisteredService();
//     }).toThrow('Service not registered: UnregisteredService');
//   });

//   test('should throw error when trying to resolve unregistered service on main container', () => {
//     const dicontainer = new DIContainer();

//     expect(() => {
//       (dicontainer as any).getUnregisteredService();
//     }).toThrow('Service not registered: UnregisteredService');
//   });

//   test('should handle complex dependency chains', () => {
//     class ServiceA {
//       public readonly uuid = crypto.randomUUID();
//     }

//     class ServiceB {
//       public readonly uuid = crypto.randomUUID();
//       constructor(public readonly serviceA: ServiceA) {}
//     }

//     class ServiceC {
//       public readonly uuid = crypto.randomUUID();
//       constructor(public readonly serviceA: ServiceA, public readonly serviceB: ServiceB) {}
//     }

//     const dicontainer = new DIContainer()
//       .register('ServiceA', () => new ServiceA(), 'scoped')
//       .register('ServiceB', (c) => new ServiceB(c.getServiceA()), 'scoped')
//       .register('ServiceC', (c) => new ServiceC(c.getServiceA(), c.getServiceB()), 'scoped');

//     const scope = dicontainer.createScope();

//     const serviceA = scope.getServiceA();
//     const serviceB = scope.getServiceB();
//     const serviceC = scope.getServiceC();

//     // All should reference the same ServiceA instance
//     expect(serviceB.serviceA).toBe(serviceA);
//     expect(serviceC.serviceA).toBe(serviceA);
//     expect(serviceC.serviceB).toBe(serviceB);
//   });

//   test('should throw error when singleton tries to depend on scoped service', () => {
//     const dicontainer = new DIContainer()
//       .register('ScopedService', () => new SomeService(), 'scoped')
//       .register('SingletonService', (c) => new SomeOtherService(c.getScopedService()), 'singleton');

//     const scope1 = dicontainer.createScope();

//     expect(() => {
//       scope1.getSingletonService();
//     }).toThrow('Invalid service dependency');
//   });

//   test('should handle transient depending on scoped service', () => {
//     const dicontainer = new DIContainer()
//       .register('ScopedService', () => new SomeService(), 'scoped')
//       .register('TransientService', (c) => new SomeOtherService(c.getScopedService()), 'transient');

//     const scope = dicontainer.createScope();

//     const transient1 = scope.getTransientService();
//     const transient2 = scope.getTransientService();
//     const scoped = scope.getScopedService();

//     // Transient instances should be different
//     expect(transient1).not.toBe(transient2);
    
//     // But they should reference the same scoped service
//     expect(transient1.someService).toBe(scoped);
//     expect(transient2.someService).toBe(scoped);
//     expect(transient1.someService).toBe(transient2.someService);
//   });

//   test('should handle factory function errors gracefully', () => {
//     const dicontainer = new DIContainer()
//       .register('FailingService', () => {
//         throw new Error('Factory failed');
//       }, 'singleton');

//     const scope = dicontainer.createScope();

//     expect(() => {
//       scope.getFailingService();
//     }).toThrow('Factory failed');
//   });

//   test('should not cache failed singleton creations', () => {
//     let callCount = 0;
//     const dicontainer = new DIContainer()
//       .register('SometimesFailingService', () => {
//         callCount++;
//         if (callCount === 1) {
//           throw new Error('First call fails');
//         }
//         return new SomeService();
//       }, 'singleton');

//     const scope = dicontainer.createScope();

//     // First call should fail
//     expect(() => {
//       scope.getSometimesFailingService();
//     }).toThrow('First call fails');

//     // Second call should succeed
//     expect(() => {
//       scope.getSometimesFailingService();
//     }).not.toThrow();

//     expect(callCount).toBe(2);
//   });

//   test('should handle interface-like registrations', () => {
//     interface IRepository {
//       save(data: any): void;
//     }

//     class DatabaseRepository implements IRepository {
//       public readonly uuid = crypto.randomUUID();
//       save(data: any): void {
//         // Implementation
//       }
//     }

//     class InMemoryRepository implements IRepository {
//       public readonly uuid = crypto.randomUUID();
//       save(data: any): void {
//         // Implementation
//       }
//     }

//     const dicontainer = new DIContainer()
//       .register('Repository', () => new DatabaseRepository(), 'singleton')
//       .register('FallbackRepository', () => new InMemoryRepository(), 'transient');

//     const scope = dicontainer.createScope();

//     const repo1 = scope.getRepository();
//     const repo2 = scope.getRepository();
//     const fallback1 = scope.getFallbackRepository();
//     const fallback2 = scope.getFallbackRepository();

//     expect(repo1).toBe(repo2);
//     expect(fallback1).not.toBe(fallback2);
//     expect(repo1).toBeInstanceOf(DatabaseRepository);
//     expect(fallback1).toBeInstanceOf(InMemoryRepository);
//   });

//   test('should support service factory with multiple dependencies', () => {
//     class Logger {
//       public readonly uuid = crypto.randomUUID();
//       log(message: string) {}
//     }

//     class Config {
//       public readonly uuid = crypto.randomUUID();
//       get(key: string): string { return 'value'; }
//     }

//     class Database {
//       public readonly uuid = crypto.randomUUID();
//       query(sql: string) {}
//     }

//     class UserService {
//       public readonly uuid = crypto.randomUUID();
//       constructor(
//         public readonly logger: Logger,
//         public readonly config: Config,
//         public readonly database: Database
//       ) {}
//     }

//     const dicontainer = new DIContainer()
//       .register('Logger', () => new Logger(), 'singleton')
//       .register('Config', () => new Config(), 'singleton')
//       .register('Database', () => new Database(), 'scoped')
//       .register('UserService', (c) => new UserService(
//         c.getLogger(),
//         c.getConfig(),
//         c.getDatabase()
//       ), 'scoped');

//     const scope1 = dicontainer.createScope();
//     const scope2 = dicontainer.createScope();

//     const userService1 = scope1.getUserService();
//     const userService2 = scope2.getUserService();

//     // Different instances per scope
//     expect(userService1).not.toBe(userService2);

//     // Shared singletons
//     expect(userService1.logger).toBe(userService2.logger);
//     expect(userService1.config).toBe(userService2.config);

//     // Different scoped services
//     expect(userService1.database).not.toBe(userService2.database);
//   });

//   test('should maintain scope isolation', () => {
//     const dicontainer = new DIContainer()
//       .register('ScopedCounter', () => ({ count: 0, increment() { this.count++; } }), 'scoped');

//     const scope1 = dicontainer.createScope();
//     const scope2 = dicontainer.createScope();

//     const counter1a = scope1.getScopedCounter();
//     const counter1b = scope1.getScopedCounter();
//     const counter2a = scope2.getScopedCounter();
//     const counter2b = scope2.getScopedCounter();

//     // Same references within scope
//     expect(counter1a).toBe(counter1b);
//     expect(counter2a).toBe(counter2b);

//     // Different references across scopes
//     expect(counter1a).not.toBe(counter2a);

//     // Modifications should be isolated
//     counter1a.increment();
//     counter1a.increment();
//     counter2a.increment();

//     expect(counter1a.count).toBe(2);
//     expect(counter1b.count).toBe(2); // Same instance
//     expect(counter2a.count).toBe(1);
//     expect(counter2b.count).toBe(1); // Same instance
//   });

//   test('should handle default lifetime as transient', () => {
//     const dicontainer = new DIContainer()
//       .register('DefaultService', () => new SomeService()); // No lifetime specified

//     const scope = dicontainer.createScope();

//     const instance1 = scope.getDefaultService();
//     const instance2 = scope.getDefaultService();

//     expect(instance1).not.toBe(instance2);
//   });

//   test('should prevent singleton depending on scoped service at any depth', () => {
//     // Test that the validation works for indirect dependencies too

//     class ScopedService {
//       public readonly uuid = crypto.randomUUID();
//     }

//     class IntermediateService {
//       public readonly uuid = crypto.randomUUID();
//       constructor(public readonly scopedDep: ScopedService) {}
//     }

//     class SingletonService {
//       public readonly uuid = crypto.randomUUID();
//       constructor(public readonly intermediateDep: IntermediateService) {}
//     }

//     const dicontainer = new DIContainer()
//       .register('ScopedService', () => new ScopedService(), 'scoped')
//       .register('IntermediateService', (c) => new IntermediateService(c.getScopedService()), 'singleton')
//       .register('SingletonService', (c) => new SingletonService(c.getIntermediateService()), 'singleton');

//     const scope = dicontainer.createScope();

//     // Should throw when trying to create IntermediateService (singleton) that depends on ScopedService
//     expect(() => {
//       scope.getIntermediateService();
//     }).toThrow('Invalid service dependency');

//     // Should also throw when trying to create SingletonService that indirectly depends on scoped service
//     expect(() => {
//       scope.getSingletonService();
//     }).toThrow('Invalid service dependency');
//   });

//   test('should allow valid lifetime dependency chains', () => {
//     // Test that valid dependency chains still work

//     class TransientService {
//       public readonly uuid = crypto.randomUUID();
//     }

//     class SingletonService {
//       public readonly uuid = crypto.randomUUID();
//       constructor(public readonly transientDep: TransientService) {}
//     }

//     class ScopedService {
//       public readonly uuid = crypto.randomUUID();
//       constructor(
//         public readonly singletonDep: SingletonService,
//         public readonly transientDep: TransientService
//       ) {}
//     }

//     const dicontainer = new DIContainer()
//       .register('TransientService', () => new TransientService(), 'transient')
//       .register('SingletonService', (c) => new SingletonService(c.getTransientService()), 'singleton')
//       .register('ScopedService', (c) => new ScopedService(c.getSingletonService(), c.getTransientService()), 'scoped');

//     const scope1 = dicontainer.createScope();
//     const scope2 = dicontainer.createScope();

//     const scoped1 = scope1.getScopedService();
//     const scoped2 = scope2.getScopedService();

//     // Scoped services should be different
//     expect(scoped1).not.toBe(scoped2);

//     // But they should share the same singleton dependency
//     expect(scoped1.singletonDep).toBe(scoped2.singletonDep);

//     // Transient dependencies should be different
//     expect(scoped1.transientDep).not.toBe(scoped2.transientDep);
//     expect(scoped1.transientDep).not.toBe(scoped1.singletonDep.transientDep);
//   });

//   test('should prevent the problematic singleton-scoped anti-pattern', () => {
//     // This test shows that the DI container now prevents the problematic pattern

//     class UserContext {
//       constructor(public readonly userId: string, public readonly tenantId: string) {}
//     }

//     class AuthService {
//       constructor(public readonly userContext: UserContext) {}
      
//       getCurrentUserId(): string {
//         return this.userContext.userId;
//       }
//     }

//     const dicontainer = new DIContainer()
//       .register('UserContext', () => new UserContext('unknown', 'unknown'), 'scoped') 
//       .register('AuthService', (c) => new AuthService(c.getUserContext()), 'singleton'); // This should now be prevented!

//     const requestScope = dicontainer.createScope();

//     // Should throw an error preventing the anti-pattern
//     expect(() => {
//       requestScope.getAuthService();
//     }).toThrow('Invalid service dependency');

//     // The proper fix: make AuthService scoped instead
//     const fixedDicontainer = new DIContainer()
//       .register('UserContext', () => new UserContext('user123', 'tenant456'), 'scoped')
//       .register('AuthService', (c) => new AuthService(c.getUserContext()), 'scoped'); // Fixed!

//     const scope1 = fixedDicontainer.createScope();
//     const scope2 = fixedDicontainer.createScope();

//     const authService1 = scope1.getAuthService();
//     const authService2 = scope2.getAuthService();

//     // Now each scope gets its own AuthService with proper UserContext isolation
//     expect(authService1).not.toBe(authService2);
//     expect(authService1.getCurrentUserId()).toBe('user123');
//     expect(authService2.getCurrentUserId()).toBe('user123');
//   });

//   test('should prevent singleton-scoped dependency even when accessed via main container', () => {
//     const dicontainer = new DIContainer()
//       .register('ScopedService', () => new SomeService(), 'scoped')
//       .register('SingletonService', (c) => new SomeOtherService(c.getScopedService()), 'singleton');

//     // Should throw even when accessing from main container
//     let error: Error | null = null;
//     try {
//       (dicontainer as any).getSingletonService();
//     } catch (e) {
//       error = e as Error;
//     }

//     expect(error).not.toBeNull();
//     expect(error!.message).toMatch(/Invalid service dependency/);
//     expect(error!.message).toContain('SingletonService');
//     expect(error!.message).toContain('ScopedService');
//   });

//   describe('Transient Service Dependencies', () => {
//     test('should allow singleton depending on transient (with caveats)', () => {
//       // This is currently allowed but can be conceptually problematic
      
//       class TransientService {
//         public readonly uuid = crypto.randomUUID();
//         public readonly createdAt = Date.now();
//       }

//       class SingletonService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(public readonly transientDep: TransientService) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('TransientService', () => new TransientService(), 'transient')
//         .register('SingletonService', (c) => new SingletonService(c.getTransientService()), 'singleton');

//       const scope1 = dicontainer.createScope();
//       const scope2 = dicontainer.createScope();

//       const singleton1 = scope1.getSingletonService();
//       const singleton2 = scope2.getSingletonService();

//       // Singleton should be the same instance
//       expect(singleton1).toBe(singleton2);

//       // The transient dependency gets "frozen" in the singleton
//       expect(singleton1.transientDep).toBe(singleton2.transientDep);

//       // But new transient instances are still created when requested directly
//       const transient1 = scope1.getTransientService();
//       const transient2 = scope2.getTransientService();
      
//       expect(transient1).not.toBe(transient2);
//       expect(transient1).not.toBe(singleton1.transientDep);
//     });

//     test('should allow scoped depending on transient', () => {
//       class TransientService {
//         public readonly uuid = crypto.randomUUID();
//       }

//       class ScopedService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(public readonly transientDep: TransientService) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('TransientService', () => new TransientService(), 'transient')
//         .register('ScopedService', (c) => new ScopedService(c.getTransientService()), 'scoped');

//       const scope1 = dicontainer.createScope();
//       const scope2 = dicontainer.createScope();

//       const scoped1 = scope1.getScopedService();
//       const scoped2 = scope2.getScopedService();

//       // Scoped services should be different across scopes
//       expect(scoped1).not.toBe(scoped2);

//       // Each scoped service gets its own transient instance
//       expect(scoped1.transientDep).not.toBe(scoped2.transientDep);

//       // But within the same scope, the transient is "frozen" in the scoped service
//       const scopedAgain = scope1.getScopedService();
//       expect(scopedAgain).toBe(scoped1); // Same scoped instance
//       expect(scopedAgain.transientDep).toBe(scoped1.transientDep); // Same transient instance
//     });

//     test('should allow transient depending on singleton', () => {
//       class SingletonService {
//         public readonly uuid = crypto.randomUUID();
//       }

//       class TransientService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(public readonly singletonDep: SingletonService) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('SingletonService', () => new SingletonService(), 'singleton')
//         .register('TransientService', (c) => new TransientService(c.getSingletonService()), 'transient');

//       const scope = dicontainer.createScope();

//       const transient1 = scope.getTransientService();
//       const transient2 = scope.getTransientService();
//       const singleton = scope.getSingletonService();

//       // Transient instances should be different
//       expect(transient1).not.toBe(transient2);

//       // But they should reference the same singleton
//       expect(transient1.singletonDep).toBe(singleton);
//       expect(transient2.singletonDep).toBe(singleton);
//       expect(transient1.singletonDep).toBe(transient2.singletonDep);
//     });

//     test('should allow transient depending on scoped', () => {
//       class ScopedService {
//         public readonly uuid = crypto.randomUUID();
//       }

//       class TransientService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(public readonly scopedDep: ScopedService) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('ScopedService', () => new ScopedService(), 'scoped')
//         .register('TransientService', (c) => new TransientService(c.getScopedService()), 'transient');

//       const scope1 = dicontainer.createScope();
//       const scope2 = dicontainer.createScope();

//       const transient1a = scope1.getTransientService();
//       const transient1b = scope1.getTransientService();
//       const transient2a = scope2.getTransientService();
//       const scoped1 = scope1.getScopedService();
//       const scoped2 = scope2.getScopedService();

//       // Transient instances should be different
//       expect(transient1a).not.toBe(transient1b);
//       expect(transient1a).not.toBe(transient2a);

//       // Within the same scope, transients should reference the same scoped service
//       expect(transient1a.scopedDep).toBe(transient1b.scopedDep);
//       expect(transient1a.scopedDep).toBe(scoped1);

//       // Across scopes, transients should reference different scoped services
//       expect(transient1a.scopedDep).not.toBe(transient2a.scopedDep);
//       expect(transient2a.scopedDep).toBe(scoped2);
//     });

//     test('complex transient dependency scenarios', () => {
//       class ConfigService {
//         public readonly uuid = crypto.randomUUID();
//       }

//       class LoggerService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(public readonly config: ConfigService) {}
//       }

//       class RequestContextService {
//         public readonly uuid = crypto.randomUUID();
//         public readonly requestId = crypto.randomUUID();
//       }

//       class BusinessService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(
//           public readonly logger: LoggerService,
//           public readonly context: RequestContextService
//         ) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('ConfigService', () => new ConfigService(), 'singleton')
//         .register('LoggerService', (c) => new LoggerService(c.getConfigService()), 'transient')
//         .register('RequestContextService', () => new RequestContextService(), 'scoped')
//         .register('BusinessService', (c) => new BusinessService(c.getLoggerService(), c.getRequestContextService()), 'transient');

//       const scope1 = dicontainer.createScope();
//       const scope2 = dicontainer.createScope();

//       const business1a = scope1.getBusinessService();
//       const business1b = scope1.getBusinessService();
//       const business2 = scope2.getBusinessService();

//       // All business services should be different (transient)
//       expect(business1a).not.toBe(business1b);
//       expect(business1a).not.toBe(business2);

//       // All loggers should be different (transient)
//       expect(business1a.logger).not.toBe(business1b.logger);
//       expect(business1a.logger).not.toBe(business2.logger);

//       // All loggers should reference the same config (singleton)
//       expect(business1a.logger.config).toBe(business1b.logger.config);
//       expect(business1a.logger.config).toBe(business2.logger.config);

//       // Context should be same within scope, different across scopes
//       expect(business1a.context).toBe(business1b.context);
//       expect(business1a.context).not.toBe(business2.context);
//     });

//     test('documents potential issues with singleton depending on transient', () => {
//       // This test documents why singleton -> transient can be problematic

//       let transientCreationCount = 0;

//       class TransientService {
//         public readonly uuid = crypto.randomUUID();
//         public readonly createdAt = Date.now();
//         constructor() {
//           transientCreationCount++;
//         }
//       }

//       class SingletonService {
//         public readonly uuid = crypto.randomUUID();
//         constructor(public readonly transientDep: TransientService) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('TransientService', () => new TransientService(), 'transient')
//         .register('SingletonService', (c) => new SingletonService(c.getTransientService()), 'singleton');

//       const scope1 = dicontainer.createScope();
//       const scope2 = dicontainer.createScope();

//       // Reset counter
//       transientCreationCount = 0;

//       // First access creates the singleton (which creates one transient)
//       const singleton1 = scope1.getSingletonService();
//       expect(transientCreationCount).toBe(1);

//       // Second access reuses the singleton (no new transient created)
//       const singleton2 = scope2.getSingletonService();
//       expect(transientCreationCount).toBe(1); // Still 1!

//       expect(singleton1).toBe(singleton2);
//       expect(singleton1.transientDep).toBe(singleton2.transientDep);

//       // But direct transient access still creates new instances
//       scope1.getTransientService();
//       expect(transientCreationCount).toBe(2);

//       scope1.getTransientService();
//       expect(transientCreationCount).toBe(3);

//       // The issue: The singleton has "captured" a transient instance,
//       // which goes against the intended behavior of transient services
//       // (to create new instances every time they're requested)
//     });

//     // Uncomment this if you want to implement strict validation
//     // test('strict mode: should prevent singleton depending on transient', () => {
//     //   // In strict mode, we could prevent this pattern entirely
//     //   const dicontainer = new DIContainer({ strictLifetimeValidation: true })
//     //     .register('TransientService', () => new SomeService(), 'transient')
//     //     .register('SingletonService', (c) => new SomeOtherService(c.getTransientService()), 'singleton');
//     //   
//     //   const scope = dicontainer.createScope();
//     //   
//     //   expect(() => {
//     //     scope.getSingletonService();
//     //   }).toThrow('Invalid service dependency: Singleton service cannot depend on transient service');
//     // });
//   });

//   describe('Advanced Dependency Validation', () => {
//     test('should detect direct circular dependencies', () => {
//       class ServiceA {
//         constructor(public serviceB: ServiceA) {} // Self-dependency
//       }

//       const dicontainer = new DIContainer()
//         .register('ServiceA', (c) => new ServiceA((c as any).getServiceA()), 'singleton');

//       const scope = dicontainer.createScope();

//       expect(() => {
//         scope.getServiceA();
//       }).toThrow('Circular dependency detected: ServiceA → ServiceA');
//     });

//     test('should detect indirect circular dependencies', () => {
//       class ServiceA {
//         constructor(public serviceB: ServiceB) {}
//       }

//       class ServiceB {
//         constructor(public serviceC: ServiceC) {}
//       }

//       class ServiceC {
//         constructor(public serviceA: ServiceA) {} // Creates A → B → C → A cycle
//       }

//       const dicontainer = new DIContainer()
//         .register('ServiceA', (c) => new ServiceA((c as any).getServiceB()), 'singleton')
//         .register('ServiceB', (c) => new ServiceB((c as any).getServiceC()), 'singleton')
//         .register('ServiceC', (c) => new ServiceC((c as any).getServiceA()), 'singleton');

//       const scope = dicontainer.createScope();

//       expect(() => {
//         scope.getServiceA();
//       }).toThrow('Circular dependency detected: ServiceA → ServiceB → ServiceC → ServiceA');
//     });

//     test('should detect complex circular dependencies', () => {
//       class ServiceA {
//         constructor(public serviceB: ServiceB) {}
//       }

//       class ServiceB {
//         constructor(public serviceC: ServiceC) {}
//       }

//       class ServiceC {
//         constructor(public serviceD: ServiceD) {}
//       }

//       class ServiceD {
//         constructor(public serviceB: ServiceB) {} // Creates A → B → C → D → B cycle
//       }

//       const dicontainer = new DIContainer()
//         .register('ServiceA', (c) => new ServiceA((c as any).getServiceB()), 'scoped')
//         .register('ServiceB', (c) => new ServiceB((c as any).getServiceC()), 'scoped')
//         .register('ServiceC', (c) => new ServiceC((c as any).getServiceD()), 'scoped')
//         .register('ServiceD', (c) => new ServiceD((c as any).getServiceB()), 'scoped');

//       const scope = dicontainer.createScope();

//       expect(() => {
//         scope.getServiceA();
//       }).toThrow('Circular dependency detected: ServiceB → ServiceC → ServiceD → ServiceB');
//     });

//     test('should allow valid complex dependency chains without false positives', () => {
//       // This tests that valid dependency chains don't trigger false circular dependency errors

//       class DatabaseService {
//         public readonly uuid = crypto.randomUUID();
//       }

//       class RepositoryService {
//         constructor(public database: DatabaseService) {}
//         public readonly uuid = crypto.randomUUID();
//       }

//       class BusinessService {
//         constructor(public repository: RepositoryService) {}
//         public readonly uuid = crypto.randomUUID();
//       }

//       class ControllerService {
//         constructor(
//           public business: BusinessService,
//           public repository: RepositoryService, // Both controller and business use repository
//           public database: DatabaseService      // Multiple services can use the same dependency
//         ) {}
//         public readonly uuid = crypto.randomUUID();
//       }

//       const dicontainer = new DIContainer()
//         .register('DatabaseService', () => new DatabaseService(), 'singleton')
//         .register('RepositoryService', (c) => new RepositoryService(c.getDatabaseService()), 'scoped')
//         .register('BusinessService', (c) => new BusinessService(c.getRepositoryService()), 'scoped')
//         .register('ControllerService', (c) => new ControllerService(
//           c.getBusinessService(),
//           c.getRepositoryService(),
//           c.getDatabaseService()
//         ), 'transient');

//       const scope = dicontainer.createScope();

//       // This should work without throwing any circular dependency errors
//       const controller = scope.getControllerService();
      
//       expect(controller).toBeDefined();
//       expect(controller.business).toBeDefined();
//       expect(controller.repository).toBeDefined();
//       expect(controller.database).toBeDefined();

//       // Verify that shared dependencies are properly resolved
//       expect(controller.business.repository).toBe(controller.repository); // Same scoped instance
//       expect(controller.repository.database).toBe(controller.database);   // Same singleton instance
//     });

//     test('should detect circular dependencies even across different lifetimes', () => {
//       class SingletonService {
//         constructor(public scoped: ScopedService) {}
//       }

//       class ScopedService {
//         constructor(public transient: TransientService) {}
//       }

//       class TransientService {
//         constructor(public singleton: SingletonService) {} // Creates circular dependency
//       }

//       const dicontainer = new DIContainer()
//         .register('SingletonService', (c) => new SingletonService((c as any).getScopedService()), 'singleton')
//         .register('ScopedService', (c) => new ScopedService((c as any).getTransientService()), 'scoped')
//         .register('TransientService', (c) => new TransientService((c as any).getSingletonService()), 'transient');

//       const scope = dicontainer.createScope();

//       expect(() => {
//         scope.getTransientService();
//       }).toThrow(/Invalid service dependency.*Singleton.*SingletonService.*scoped.*ScopedService/);
//     });

//     test('should provide clear error messages for missing dependencies', () => {
//       // This test verifies the existing behavior for unregistered services
//       const dicontainer = new DIContainer();
//       const scope = dicontainer.createScope();

//       expect(() => {
//         (scope as any).getMissingService();
//       }).toThrow('Service not registered: MissingService');
//     });

//     test('should handle multiple independent circular dependency attempts', () => {
//       // Test that the resolution stack is properly managed across multiple failed attempts

//       class ServiceA {
//         constructor(public serviceB: ServiceA) {}
//       }

//       class ServiceX {
//         constructor(public serviceY: ServiceX) {}
//       }

//       const dicontainer = new DIContainer()
//         .register('ServiceA', (c) => new ServiceA((c as any).getServiceA()), 'singleton')
//         .register('ServiceX', (c) => new ServiceX((c as any).getServiceX()), 'singleton');

//       const scope = dicontainer.createScope();

//       // First circular dependency attempt
//       expect(() => {
//         scope.getServiceA();
//       }).toThrow('Circular dependency detected: ServiceA → ServiceA');

//       // Second independent circular dependency attempt should also work
//       expect(() => {
//         scope.getServiceX();
//       }).toThrow('Circular dependency detected: ServiceX → ServiceX');

//       // The resolution stack should be clean between attempts
//       // This verifies that failed resolutions don't leave the stack in a bad state
//     });

//     test('should detect deeply nested circular dependencies', () => {
//       // Test with a longer chain to ensure the algorithm works with deep nesting

//       class Service1 {
//         constructor(public service2: Service2) {}
//       }
//       class Service2 {
//         constructor(public service3: Service3) {}
//       }
//       class Service3 {
//         constructor(public service4: Service4) {}
//       }
//       class Service4 {
//         constructor(public service5: Service5) {}
//       }
//       class Service5 {
//         constructor(public service6: Service6) {}
//       }
//       class Service6 {
//         constructor(public service1: Service1) {} // Back to Service1
//       }

//       const dicontainer = new DIContainer()
//         .register('Service1', (c) => new Service1((c as any).getService2()), 'singleton')
//         .register('Service2', (c) => new Service2((c as any).getService3()), 'singleton')
//         .register('Service3', (c) => new Service3((c as any).getService4()), 'singleton')
//         .register('Service4', (c) => new Service4((c as any).getService5()), 'singleton')
//         .register('Service5', (c) => new Service5((c as any).getService6()), 'singleton')
//         .register('Service6', (c) => new Service6((c as any).getService1()), 'singleton');

//       const scope = dicontainer.createScope();

//       expect(() => {
//         scope.getService1();
//       }).toThrow('Circular dependency detected: Service1 → Service2 → Service3 → Service4 → Service5 → Service6 → Service1');
//     });
//   });

// });