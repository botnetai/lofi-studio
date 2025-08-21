import { NextRequest, NextResponse } from 'next/server';
import { reconcileStuckGenerations } from '@/server/lib/reconciler';

export async function POST(request: NextRequest) {
  try {
    // You might want to add authentication/authorization here
    // For now, allowing any request to trigger reconciliation

    await reconcileStuckGenerations();

    return NextResponse.json({
      success: true,
      message: 'Reconciler completed successfully'
    });
  } catch (error) {
    console.error('Reconciler API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Reconciler failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual triggering (useful for debugging)
export async function GET() {
  try {
    await reconcileStuckGenerations();

    return NextResponse.json({
      success: true,
      message: 'Reconciler completed successfully'
    });
  } catch (error) {
    console.error('Reconciler API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Reconciler failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
