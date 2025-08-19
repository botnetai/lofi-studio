import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/server/supabaseServer';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const code = searchParams.get('code');
	if (code) {
		const supabase = await getServerSupabaseClient();
		await supabase.auth.exchangeCodeForSession(code);
	}
	return NextResponse.redirect(new URL('/', request.url));
}


