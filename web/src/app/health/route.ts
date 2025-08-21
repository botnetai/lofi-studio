import { reconcileStuckGenerations } from '@/server/lib/reconciler';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runReconciler = url.searchParams.get('reconciler') === 'true';

  if (runReconciler) {
    try {
      console.log('Running reconciler via health check...');
      await reconcileStuckGenerations();
      return Response.json({
        ok: true,
        reconciler: 'completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Reconciler failed during health check:', error);
      return Response.json(
        {
          ok: false,
          reconciler: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  }

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString()
  });
}


