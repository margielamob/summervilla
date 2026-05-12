import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

type Bindings = Env;

export const rsvpSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(120),
	email: z.string().trim().email("Enter a valid email").max(200),
	phone: z.string().trim().min(5, "Enter a valid phone number").max(40),
	attending: z.enum(["yes", "no"]).transform((v) => (v === "yes" ? 1 : 0)),
	plus_one: z.coerce.number().int().min(0).max(5).default(0),
	message: z
		.string()
		.trim()
		.max(2000)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : undefined)),
	password: z.string().min(1, "Password is required"),
});

export type RsvpResult =
	| { ok: true }
	| { ok: false; error: "validation"; fields: Record<string, string> }
	| { ok: false; error: "password" }
	| { ok: false; error: "server" };

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

const app = new Hono<{ Bindings: Bindings }>();

app.post(
	"/rsvp",
	zValidator("form", rsvpSchema, (result, c) => {
		if (!result.success) {
			const fields: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const key = String(issue.path[0] ?? "_");
				if (!fields[key]) fields[key] = issue.message;
			}
			return c.json<RsvpResult>(
				{ ok: false, error: "validation", fields },
				400,
			);
		}
	}),
	async (c, next) => {
		const input = c.req.valid("form");
		const expected = c.env.RSVP_PASSWORD;
		if (!expected || !constantTimeEqual(input.password, expected)) {
			return c.json<RsvpResult>({ ok: false, error: "password" }, 401);
		}
		await next();
	},
	async (c) => {
		const input = c.req.valid("form");
		try {
			await c.env.DB.prepare(
				"INSERT INTO rsvps (name, email, phone, attending, plus_one, message) VALUES (?, ?, ?, ?, ?, ?)",
			)
				.bind(
					input.name,
					input.email,
					input.phone,
					input.attending,
					input.plus_one,
					input.message ?? null,
				)
				.run();
		} catch {
			return c.json<RsvpResult>({ ok: false, error: "server" }, 500);
		}
		return c.json<RsvpResult>({ ok: true }, 200);
	},
);

export default app;
