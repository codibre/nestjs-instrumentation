# OpenTelemetry NestJS Instrumentation

[![NPM Version](https://img.shields.io/npm/v/otel-nestjs-instrumentation.svg)](https://www.npmjs.com/package/otel-nestjs-instrumentation)
[![License](https://img.shields.io/npm/l/otel-nestjs-instrumentation.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Comprehensive OpenTelemetry instrumentation for NestJS applications with advanced span management, distributed tracing, and event-driven monitoring.

## 🎯 Why This Library?

While the official `@opentelemetry/instrumentation-nestjs-core` handles basic HTTP controller instrumentation, **this library fills the gaps** for specialized use cases:

### ✅ **What We Cover (That Official Packages Don't)**
- **SQS & Kafka Consumers** - Complete instrumentation for message queue processing
- **Background Jobs & Cron Tasks** - Proper spans for scheduled and async work
- **HTTP/2 Applications** - Full support for modern HTTP/2 protocols
- **Custom Protocols** - Microservices with gRPC, WebSocket, or custom transports
- **Manual Transaction Control** - Fine-grained span management for complex flows

### 🔄 **Complements Official Instrumentation**
This library **works alongside** the official OpenTelemetry packages - it doesn't replace them, it enhances them for scenarios they don't cover.

## 🚀 Quick Start

### Installation

```bash
npm install otel-nestjs-instrumentation @opentelemetry/api
# or
pnpm add otel-nestjs-instrumentation @opentelemetry/api
```

> **📋 Setup Checklist:**
> 1. Install the package
> 2. Configure OpenTelemetry SDK initialization **before** your NestJS app starts
> 3. Import `OtelNestjsInstrumentationModule` as the **FIRST** module in your AppModule
> 4. Configure OpenTelemetry environment variables as needed

### ⚠️ Important: Module Import Order

**The `OtelNestjsInstrumentationModule` MUST be imported as the first module in your `AppModule`.** This ensures proper instrumentation setup before other modules are initialized.

```typescript
import { Module } from '@nestjs/common';
import { OtelNestjsInstrumentationModule } from 'otel-nestjs-instrumentation';

@Module({
  imports: [
    OtelNestjsInstrumentationModule, // 👈 MUST be first!
    // ... other modules after
  ],
})
export class AppModule {}
```

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { OtelNestjsInstrumentationModule } from 'otel-nestjs-instrumentation';

@Module({
  imports: [
    OtelNestjsInstrumentationModule, // 👈 Add this line
  ],
})
export class AppModule {}
```

That's it! 🎉 Your NestJS application now has comprehensive OpenTelemetry instrumentation.

## 📋 Use Cases

### 1. SQS Message Processing

```typescript
@Controller('sqs')
export class SqsController {
  @Post('process-message')
  async processSqsMessage(@Body() message: SqsMessage) {
    // ✅ Automatic span creation with distributed tracing
    // ✅ Proper transaction naming: "SqsController.processSqsMessage"
    // ✅ Error handling and span status management

    return this.messageProcessor.process(message);
  }
}
```

### 2. Kafka Consumer

```typescript
@Controller('kafka')
export class KafkaController {
  @Post('consume')
  async consumeKafkaMessage(@Body() message: KafkaMessage) {
    // ✅ Spans automatically created for each message
    // ✅ Trace context preserved across async operations
    // ✅ Custom attributes for topic, partition, offset

    await this.processMessage(message);
    return { status: 'processed' };
  }
}
```

### 3. Background Jobs & Cron Tasks

```typescript
@Controller('jobs')
export class JobController {
  @Post('background-task')
  async runBackgroundJob(@Body() jobData: any) {
    // ✅ Perfect for cron jobs, scheduled tasks, async workers
    // ✅ Complete visibility into background processing
    // ✅ Error tracking and performance monitoring

    return this.jobProcessor.execute(jobData);
  }
}
```

### 4. HTTP/2 & Custom Protocols

```typescript
@Controller('api/v2')
export class Http2Controller {
  @Get('data')
  async getData() {
    // ✅ Works seamlessly with HTTP/2
    // ✅ Proper span context in modern applications
    // ✅ Distributed tracing across services

    return this.dataService.fetchData();
  }
}
```

## 🔧 Advanced Features

### Event-Driven Monitoring

Monitor span lifecycle events in real-time:

```typescript
@Injectable()
export class MonitoringService {
  constructor(private otelEvents: OtelNestjsEvent) {
    // Listen for span lifecycle events
    this.otelEvents.on('spanStarted', (traceId) => {
      console.log(`🟢 Span started: ${traceId}`);
      this.metrics.incrementCounter('spans.started');
    });

    this.otelEvents.on('spanFinished', (traceId) => {
      console.log(`🔵 Span finished: ${traceId}`);
      this.metrics.incrementCounter('spans.finished');
    });

    this.otelEvents.on('spanStartFailed', (traceId, error) => {
      console.error(`🔴 Span start failed: ${traceId}`, error);
      this.metrics.incrementCounter('spans.failed');
    });
  }
}
```

### Performance Tracking

Track request durations and performance:

```typescript
@Injectable()
export class PerformanceTracker {
  private spanTimes = new Map<string, number>();

  constructor(private otelEvents: OtelNestjsEvent) {
    this.otelEvents.on('spanStarted', (traceId) => {
      this.spanTimes.set(traceId!, Date.now());
    });

    this.otelEvents.on('spanFinished', (traceId) => {
      const startTime = this.spanTimes.get(traceId!);
      if (startTime) {
        const duration = Date.now() - startTime;
        console.log(`⏱️ Request duration: ${duration}ms`);

        // Send to your metrics system
        this.metrics.recordDuration('request.duration', duration);
        this.spanTimes.delete(traceId!);
      }
    });
  }
}
```

### Custom Business Logic Integration

```typescript
@Injectable()
export class BusinessMetricsService {
  constructor(private otelEvents: OtelNestjsEvent) {
    this.otelEvents.on('spanStarted', (traceId) => {
      // Add custom business context to spans
      this.addBusinessContext(traceId);
    });
  }

  private addBusinessContext(traceId: string) {
    // Access the current span via OpenTelemetry APIs
    // and add custom attributes for business metrics
  }
}
```

## 🎛️ Configuration

### Environment Variables

```bash
# Optional: Configure OpenTelemetry (standard OTEL env vars work)
OTEL_SERVICE_NAME=my-nestjs-app
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_RESOURCE_ATTRIBUTES=service.version=1.0.0
```

### Advanced Configuration

> **⚠️ Critical:** OpenTelemetry SDK must be initialized **before** importing your NestJS application modules.

```typescript
// ✅ CORRECT: Initialize OpenTelemetry SDK first
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  // Your OpenTelemetry configuration
});

sdk.start();

// ✅ THEN start your NestJS app
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

## 📊 What Gets Instrumented

### Automatic Span Creation
- ✅ **Controller Methods** - Every HTTP endpoint, message handler, job processor
- ✅ **Custom Transaction Names** - Based on `ControllerName.methodName`
- ✅ **Distributed Tracing** - Headers extracted and propagated automatically
- ✅ **Error Handling** - Exceptions recorded in spans with proper status codes

### Span Attributes
```typescript
{
  // HTTP requests
  "http.method": "POST",
  "http.url": "/api/sqs/process-message",
  "http.route": "/api/sqs/process-message",

  // NestJS context
  "nestjs.controller": "SqsController",
  "nestjs.handler": "processSqsMessage",

  // RPC/Custom protocols
  "rpc.method": "processMessage",

  // Error information (when applicable)
  "error.name": "ValidationError",
  "error.message": "Invalid message format",
  "error.stack": "..." // Full stack trace
}
```

## 🏗️ Architecture

### Components

1. **`OtelContextGuard`** - Sets up span context for each request
2. **`OtelInterceptor`** - Manages span lifecycle and error handling
3. **`OtelNestjsEvent`** - Event emitter for span lifecycle monitoring
4. **`InternalContext`** - Async local storage for span context management

### Flow

```
Request → Guard (Create Span) → Controller → Interceptor (Finish Span) → Response
    ↓                              ↓                        ↓
  spanStarted event           Business Logic          spanFinished event
```

## 🔍 Monitoring & Observability

### Events API

```typescript
interface OtelNestjsEventType {
  'spanStarted': (traceId: string) => void;
  'spanFinished': (traceId: string) => void;
  'spanStartFailed': (traceId: string, error: Error) => void;
}
```

### Integration Examples

#### Prometheus Metrics
```typescript
@Injectable()
export class PrometheusMetrics {
  private readonly spanCounter = new Counter({
    name: 'otel_spans_total',
    help: 'Total number of spans',
    labelNames: ['status']
  });

  constructor(private otelEvents: OtelNestjsEvent) {
    this.otelEvents.on('spanStarted', () => {
      this.spanCounter.inc({ status: 'started' });
    });

    this.otelEvents.on('spanFinished', () => {
      this.spanCounter.inc({ status: 'finished' });
    });
  }
}
```

#### Custom Logging
```typescript
@Injectable()
export class StructuredLogger {
  constructor(private otelEvents: OtelNestjsEvent) {
    this.otelEvents.on('spanStarted', (traceId) => {
      this.logger.info('Span started', {
        traceId,
        timestamp: new Date().toISOString(),
        component: 'otel-instrumentation'
      });
    });
  }
}
```

## 🔧 Troubleshooting

### OpenTelemetry Not Working?

1. **Check OpenTelemetry Installation**
   ```bash
   npm list @opentelemetry/api
   ```

2. **Verify SDK Setup**
   ```typescript
   // Make sure you have OpenTelemetry SDK configured
   import { NodeSDK } from '@opentelemetry/sdk-node';
   ```

3. **Enable Debug Logging**
   ```bash
   OTEL_LOG_LEVEL=debug npm start
   ```

### No Spans Appearing?

The library gracefully handles missing OpenTelemetry dependencies. If spans aren't appearing:

1. Ensure `@opentelemetry/api` is installed
2. Configure an OpenTelemetry exporter
3. Check that your OpenTelemetry SDK is properly initialized

### Performance Impact

- ✅ **Minimal Overhead** - Only active when OpenTelemetry is configured
- ✅ **Graceful Degradation** - No impact if OpenTelemetry is unavailable
- ✅ **Async Context** - Uses efficient AsyncLocalStorage for context management
- ✅ **Error Resilient** - Instrumentation failures never break your application

## 🆚 Comparison with Official Packages

| Feature | Official `@opentelemetry/instrumentation-nestjs-core` | This Library |
|---------|-----------------------------------------------------|--------------|
| HTTP Controllers | ✅ Full support | ✅ Enhanced support |
| SQS/Kafka Consumers | ❌ Not covered | ✅ Full support |
| Background Jobs | ❌ Not covered | ✅ Full support |
| HTTP/2 Applications | ⚠️ Limited | ✅ Full support |
| Custom Protocols | ❌ Not covered | ✅ Full support |
| Event System | ❌ No events | ✅ Rich event system |
| Async Context | ❌ Basic | ✅ Advanced management |
| Error Handling | ✅ Basic | ✅ Enhanced with attributes |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../README.md#🤝-contributing) for details on development setup, testing, and submission guidelines.

## 📄 License

MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🔗 Related Packages

- [`@opentelemetry/instrumentation-nestjs-core`](https://www.npmjs.com/package/@opentelemetry/instrumentation-nestjs-core) - Official NestJS HTTP instrumentation
- [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) - Automatic Node.js instrumentation
- [`newrelic-nestjs-instrumentation`](../newrelic-nestjs-instrumentation) - New Relic version of this library

---

**Built with ❤️ by [Codibre](https://github.com/codibre)**
