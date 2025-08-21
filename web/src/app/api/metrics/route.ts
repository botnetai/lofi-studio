import { metrics } from '@/server/lib/metrics';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');

    if (operation) {
      // Return metrics for specific operation
      const operationMetrics = metrics.getMetrics(operation);
      const successRate = metrics.getSuccessRate(operation);
      const averageDuration = metrics.getAverageDuration(operation);
      const errorCount = metrics.getErrorCount(operation);

      return NextResponse.json({
        operation,
        count: operationMetrics.length,
        successRate,
        averageDuration,
        errorCount,
        metrics: operationMetrics.slice(-10) // Last 10 metrics
      });
    } else {
      // Return summary of all operations
      const summary = metrics.getSummary();
      return NextResponse.json({
        summary,
        totalMetrics: metrics.getMetrics().length,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
