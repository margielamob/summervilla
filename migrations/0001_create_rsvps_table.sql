CREATE TABLE rsvps (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	phone TEXT NOT NULL,
	attending INTEGER NOT NULL CHECK (attending IN (0, 1)),
	plus_one INTEGER NOT NULL DEFAULT 0,
	message TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_rsvps_email ON rsvps(email);
