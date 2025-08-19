import type { inferAsyncReturnType } from '@trpc/server';
import { getServerSupabaseClient } from '@/server/supabaseServer';

export async function createContext() {
	const supabase = await getServerSupabaseClient();
	const { data } = await supabase.auth.getUser();
	return { user: data.user ?? null, supabase };
}

export type AppContext = inferAsyncReturnType<typeof createContext>;


