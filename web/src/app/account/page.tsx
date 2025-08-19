import { getServerSupabaseClient } from '@/server/supabaseServer';
import Link from 'next/link';

export default async function AccountPage() {
	const supabase = await getServerSupabaseClient();
	const { data } = await supabase.auth.getUser();
	const user = data.user;
	return (
		<div className="max-w-2xl mx-auto p-8 space-y-4">
			<h1 className="text-xl font-semibold">Account</h1>
			{user ? (
				<div className="space-y-2">
					<div className="text-sm">Signed in as {user.email}</div>
					<form action="/auth/signout" method="post">
						<button className="bg-black text-white px-4 py-2 rounded">Sign out</button>
					</form>
				</div>
			) : (
				<Link href="/login" className="underline">Sign in</Link>
			)}
		</div>
	);
}


