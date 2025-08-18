import { initTRPC } from '@trpc/server';

export type Context = object;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;


