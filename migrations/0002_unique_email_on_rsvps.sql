DROP INDEX IF EXISTS idx_rsvps_email;
CREATE UNIQUE INDEX idx_rsvps_email ON rsvps(email);
