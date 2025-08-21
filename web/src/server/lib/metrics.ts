interface MetricData {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

class Metrics {
  private metrics: MetricData[] = [];
  private readonly MAX_STORED_METRICS = 1000;

  record(data: MetricData) {
    this.metrics.push({
      ...data,
      timestamp: Date.now()
    } as any);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_STORED_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_STORED_METRICS);
    }

    // Log to console for now (could be sent to external service)
    console.log(JSON.stringify({
      type: 'metric',
      timestamp: new Date().toISOString(),
      ...data
    }));
  }

  // Get metrics for a specific operation
  getMetrics(operation?: string): MetricData[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return this.metrics;
  }

  // Calculate success rate for an operation
  getSuccessRate(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 1;

    const successful = operationMetrics.filter(m => m.success).length;
    return successful / operationMetrics.length;
  }

  // Get average duration for an operation
  getAverageDuration(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 0;

    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / operationMetrics.length;
  }

  // Get error count for an operation
  getErrorCount(operation: string): number {
    return this.getMetrics(operation).filter(m => !m.success).length;
  }

  // Get metrics summary
  getSummary() {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    return operations.map(operation => ({
      operation,
      count: this.getMetrics(operation).length,
      successRate: this.getSuccessRate(operation),
      averageDuration: this.getAverageDuration(operation),
      errorCount: this.getErrorCount(operation)
    }));
  }
}

export const metrics = new Metrics();

// Helper for timing operations with automatic metric recording
export function withMetrics<T>(
  operation: string,
  userId?: string,
  metadata?: Record<string, any>
) {
  const start = Date.now();

  return {
    success: (result: T, additionalMetadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      metrics.record({
        operation,
        duration,
        success: true,
        userId,
        metadata: { ...metadata, ...additionalMetadata }
      });
      return result;
    },
    error: (error: Error, additionalMetadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      metrics.record({
        operation,
        duration,
        success: false,
        error: error.message,
        userId,
        metadata: { ...metadata, ...additionalMetadata }
      });
      throw error;
    }
  };
}
