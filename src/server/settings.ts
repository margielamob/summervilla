const RSVP_PASSWORD_KEY = "rsvp_password";

type SettingRow = {
	value: string;
};

export async function getStoredRsvpPassword(
	db: D1Database,
): Promise<string | undefined> {
	try {
		const row = await db
			.prepare("SELECT value FROM app_settings WHERE key = ?")
			.bind(RSVP_PASSWORD_KEY)
			.first<SettingRow>();

		return row?.value || undefined;
	} catch (err) {
		console.error("rsvp password setting lookup failed", err);
		return undefined;
	}
}

export async function getRsvpPassword(env: Env): Promise<string | undefined> {
	return (await getStoredRsvpPassword(env.DB)) ?? env.RSVP_PASSWORD;
}

export async function setRsvpPassword(
	db: D1Database,
	password: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO app_settings (key, value, updated_at)
			VALUES (?, ?, unixepoch())
			ON CONFLICT(key) DO UPDATE SET
				value = excluded.value,
				updated_at = unixepoch()`,
		)
		.bind(RSVP_PASSWORD_KEY, password)
		.run();
}
