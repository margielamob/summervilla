type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}

declare namespace Cloudflare {
	interface Env {
		RSVP_PASSWORD: string;
		ADMIN_PASSWORD: string;
	}
}
