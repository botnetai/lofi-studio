import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { getServerSupabaseClient } from '@/server/supabaseServer';

export async function POST(request: Request) {
	const supabase = await getServerSupabaseClient();
	await supabase.auth.signOut();
	return NextResponse.redirect(new URL('/', request.url));
}


