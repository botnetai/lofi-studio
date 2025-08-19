"use client";
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function LoginPage() {
	const [email, setEmail] = useState('');
	const [sent, setSent] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const supabase = getBrowserSupabaseClient();
		await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/callback` } });
		setSent(true);
	}

	return (
		<div className="max-w-md mx-auto p-8 space-y-4">
			<h1 className="text-xl font-semibold">Sign in</h1>
			<form onSubmit={onSubmit} className="space-y-3">
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="you@example.com"
					className="w-full border rounded px-3 py-2"
					required
				/>
				<button className="bg-black text-white px-4 py-2 rounded" type="submit">
					Send magic link
				</button>
			</form>
			{sent && <p className="text-sm text-neutral-600">Check your email for a sign-in link.</p>}
		</div>
	);
}


