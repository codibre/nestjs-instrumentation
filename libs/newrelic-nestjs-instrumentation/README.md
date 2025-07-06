# New Relic NestJS Instrumentation

A comprehensive New Relic instrumentation library for NestJS applications, designed to provide automatic transaction tracking and monitoring for scenarios not covered by standard New Relic auto-instrumentation.

[![npm version](https://img.shields.io/npm/v/newrelic-nestjs-instrumentation.svg)](https://www.npmjs.com/package/newrelic-nestjs-instrumentation)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Overview

This library provides robust New Relic instrumentation for NestJS applications, especially targeting use cases where New Relic's automatic instrumentation falls short:

- **SQS and Kafka Consumers** - Track message processing with proper transaction boundaries
- **HTTP/2 Applications** - Full support for HTTP/2 protocol instrumentation
- **Custom Applications** - Cron jobs, background tasks, and microservices
- **Microservice Architectures** - Distributed tracing across custom protocols
- **WebSocket Applications** - Real-time application monitoring
- **GraphQL APIs** - Detailed resolver and subscription tracking

## Features

- 🚀 **Automatic Transaction Management** - Zero-configuration transaction creation and lifecycle management
- 🔄 **Distributed Tracing** - Full support for distributed tracing headers and correlation
- 📊 **Event-Driven Monitoring** - Real-time transaction event emissions for custom monitoring
- 🛡️ **HTTP/2 Compatible** - Full support for HTTP/2 applications
- 🔧 **Custom Protocol Support** - Works with any NestJS controller-based application
- 📱 **Async Context Preservation** - Maintains transaction context across async operations
- 🎯 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- 🔍 **Debugging Support** - Built-in event system for transaction monitoring and debugging

## Installation

```bash
npm install newrelic-nestjs-instrumentation newrelic
# or
yarn add newrelic-nestjs-instrumentation newrelic
# or
pnpm add newrelic-nestjs-instrumentation newrelic
```

## Quick Start

### 1. Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { NestJsNewrelicInstrumentationModule } from 'newrelic-nestjs-instrumentation';

@Module({
  imports: [
    NestJsNewrelicInstrumentationModule
  ],
})
export class AppModule {}
```

### 2. New Relic Configuration

Ensure you have New Relic configured in your application:

```typescript
// main.ts (before importing any other modules)
import 'newrelic';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### 3. Environment Variables

```bash
NEW_RELIC_LICENSE_KEY=your_license_key
NEW_RELIC_APP_NAME=your_app_name
NEW_RELIC_LOG_LEVEL=info
```

## Use Cases

### SQS Message Processing

```typescript
@Controller('sqs')
export class SqsController {
  constructor(private readonly sqsService: SqsService) {}

  @Post('process-message')
  async processMessage(@Body() sqsEvent: any) {
    // New Relic transaction automatically created
    // Transaction name: "SqsController.processMessage"

    for (const record of sqsEvent.Records) {
      await this.sqsService.processMessage(record);
    }

    return { processed: sqsEvent.Records.length };
  }
}
```

### Kafka Consumer

```typescript
@Controller('kafka')
export class KafkaController {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly events: NewReliNestjsEvent
  ) {
    // Monitor Kafka message processing
    this.events.on('transactionStarted', (transactionId) => {
      console.log(`Processing Kafka message in transaction: ${transactionId}`);
    });
  }

  @Post('handle-message')
  async handleMessage(@Body() kafkaMessage: any) {
    // Automatic transaction tracking for Kafka messages
    const result = await this.kafkaService.process(kafkaMessage);

    // Transaction context preserved throughout processing
    return result;
  }
}
```

### HTTP/2 Application

```typescript
// Works seamlessly with HTTP/2
@Controller('users')
export class UserController {
  @Get(':id')
  async getUser(@Param('id') id: string) {
    // Full HTTP/2 support with proper transaction tracking
    // Distributed tracing headers automatically handled
    return this.userService.findById(id);
  }
}
```

### Cron Jobs and Background Tasks

```typescript
@Injectable()
export class CronService {
  constructor(private readonly events: NewReliNestjsEvent) {}

  @Cron('0 */6 * * *') // Every 6 hours
  async processScheduledTask() {
    // For cron jobs, manually trigger the guard and interceptor
    // or create a controller endpoint and call it internally
    return this.performTask();
  }
}

// Better approach for cron jobs:
@Controller('cron')
export class CronController {
  @Post('scheduled-task')
  async scheduledTask() {
    // This will be properly instrumented
    return this.cronService.performTask();
  }
}
```

## API Reference

### NestJsNewrelicInstrumentationModule

The main module that sets up New Relic instrumentation.

```typescript
@Module({
  imports: [NestJsNewrelicInstrumentationModule]
})
export class AppModule {}
```

**What it provides:**
- Global `NewrelicContextGuard` for transaction management
- Global `NewrelicInterceptor` for transaction lifecycle
- `NewReliNestjsEvent` service for event monitoring

### NewReliNestjsEvent

Event emitter service for monitoring transaction lifecycle.

```typescript
@Injectable()
export class MyService {
  constructor(private events: NewReliNestjsEvent) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Transaction started successfully
    this.events.on('transactionStarted', (transactionId: string) => {
      console.log(`Transaction ${transactionId} started`);
    });

    // Transaction completed (success or error)
    this.events.on('transactionFinished', (transactionId: string) => {
      console.log(`Transaction ${transactionId} finished`);
    });

    // Transaction creation failed
    this.events.on('transactionStartFailed', (transactionId: string, error: unknown) => {
      console.error(`Transaction ${transactionId} failed to start:`, error);
    });
  }
}
```

### NewrelicContextGuard

Guard that sets up New Relic transaction context (automatically applied globally).

**Transaction Naming Convention:**
- Format: `ControllerName.methodName`
- Example: `UserController.getUser`, `KafkaController.processMessage`

### NewrelicInterceptor

Interceptor that manages transaction lifecycle (automatically applied globally).

## Advanced Usage

### Custom Monitoring Integration

```typescript
@Injectable()
export class CustomMonitoringService {
  private transactionMetrics = new Map<string, { startTime: number }>();

  constructor(private events: NewReliNestjsEvent) {
    this.setupAdvancedMonitoring();
  }

  private setupAdvancedMonitoring() {
    this.events.on('transactionStarted', (transactionId) => {
      this.transactionMetrics.set(transactionId, {
        startTime: Date.now()
      });

      // Send to external monitoring system
      this.externalMonitoring.trackTransactionStart(transactionId);
    });

    this.events.on('transactionFinished', (transactionId) => {
      const metrics = this.transactionMetrics.get(transactionId);
      if (metrics) {
        const duration = Date.now() - metrics.startTime;
        this.externalMonitoring.trackTransactionEnd(transactionId, duration);
        this.transactionMetrics.delete(transactionId);
      }
    });
  }
}
```

### Error Tracking

```typescript
@Injectable()
export class ErrorTrackingService {
  constructor(private events: NewReliNestjsEvent) {
    this.events.on('transactionStartFailed', (transactionId, error) => {
      // Log to external error tracking service
      this.errorTracker.captureException(error, {
        transactionId,
        context: 'newrelic-transaction-start'
      });
    });
  }
}
```

## Best Practices

### 1. Module Import Order

Always import the New Relic module early in your application:

```typescript
// Correct order
@Module({
  imports: [
    NestJsNewrelicInstrumentationModule, // First
    DatabaseModule,
    AuthModule,
    // Other modules...
  ],
})
export class AppModule {}
```

### 2. Environment Configuration

Use environment-specific New Relic configuration:

```typescript
// config/newrelic.config.ts
export const newRelicConfig = {
  development: {
    enabled: false,
    logging: { level: 'trace' }
  },
  production: {
    enabled: true,
    logging: { level: 'info' }
  }
};
```

### 3. Error Handling

Always handle New Relic instrumentation errors gracefully:

```typescript
@Injectable()
export class SafeInstrumentationService {
  constructor(private events: NewReliNestjsEvent) {
    this.events.on('transactionStartFailed', (transactionId, error) => {
      // Log but don't throw - keep application functional
      this.logger.warn(`New Relic transaction failed: ${transactionId}`, error);
    });
  }
}
```

### 4. Performance Monitoring

Monitor the performance impact of instrumentation:

```typescript
@Injectable()
export class PerformanceMonitoringService {
  constructor(private events: NewReliNestjsEvent) {
    this.events.on('transactionStarted', (transactionId) => {
      // Track instrumentation overhead
      this.performanceMonitor.startTimer(`instrumentation.${transactionId}`);
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Transactions not appearing in New Relic**
   - Ensure New Relic agent is properly configured
   - Check that `NEW_RELIC_LICENSE_KEY` is set
   - Verify the module is imported before other modules

2. **HTTP/2 requests not tracked**
   - This library specifically addresses HTTP/2 compatibility
   - Ensure you're using NestJS controllers (not pure HTTP/2 handlers)

3. **SQS/Kafka messages not instrumented**
   - Make sure your message handlers are in NestJS controllers
   - Use `@Post()` or similar decorators for handler methods

4. **Events not firing**
   - Verify `NewReliNestjsEvent` is properly injected
   - Check that the module is correctly imported

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
@Injectable()
export class DebugService {
  constructor(private events: NewReliNestjsEvent) {
    // Log all transaction events
    this.events.on('transactionStarted', (id) =>
      console.log(`[DEBUG] Transaction started: ${id}`));
    this.events.on('transactionFinished', (id) =>
      console.log(`[DEBUG] Transaction finished: ${id}`));
    this.events.on('transactionStartFailed', (id, error) =>
      console.error(`[DEBUG] Transaction failed: ${id}`, error));
  }
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../README.md#🤝-contributing) for details on development setup, testing, and submission guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/newrelic-nestjs-instrumentation.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run linting
pnpm lint

# Build the project
pnpm build
```

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://github.com/your-org/newrelic-nestjs-instrumentation/wiki)
- 🐛 [Issue Tracker](https://github.com/your-org/newrelic-nestjs-instrumentation/issues)
- 💬 [Discussions](https://github.com/your-org/newrelic-nestjs-instrumentation/discussions)

## Related Projects

- [New Relic Node.js Agent](https://github.com/newrelic/node-newrelic)
- [NestJS Framework](https://github.com/nestjs/nest)
- [New Relic Winston Enricher](https://github.com/newrelic/node-newrelic-winston)
