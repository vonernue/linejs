import { lookup } from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";

const DNS_TTL_MS = 120_000;
const REJECTED_TTL_MS = 900_000;
const MAX_ADDRESSES_PER_REQUEST = 5;

type ResolveAddresses = (hostname: string) => Promise<string[]>;
type FetchAtAddress = (request: Request, address: string) => Promise<Response>;

async function resolveIPv4(hostname: string): Promise<string[]> {
	return (await lookup(hostname, { all: true, family: 4 })).map(({ address }) => address);
}

function createAddressFetch(hostname: string): FetchAtAddress {
	let current: { address: string; agent: Agent } | undefined;
	return async (request, address) => {
		const body = await request.arrayBuffer();
		if (current?.address !== address) {
			const previous = current;
			const agent = new Agent({
				allowH2: false,
				connect: {
					lookup(host, options, callback) {
						if (host !== hostname) {
							callback(new Error("Unexpected LEGY gateway hostname"), "", 4);
							return;
						}
						if (options.all) callback(null, [{ address, family: 4 }]);
						else callback(null, address, 4);
					},
				},
			});
			current = { address, agent };
			if (previous) void previous.agent.close().catch(() => {});
		}
		const dispatcher = current.agent;
		const response = await undiciFetch(request.url, {
			method: request.method,
			headers: [...request.headers],
			body,
			signal: request.signal,
			redirect: "error",
			dispatcher,
		});
		return new Response(response.body ? await response.arrayBuffer() : null, {
			status: response.status,
			statusText: response.statusText,
			headers: [...response.headers],
		});
	};
}

/** Rotate DNS addresses only on an explicit empty 404 from the outer LEGY gateway. */
export class LegyGateway {
	readonly #hostname: string;
	readonly #resolve: ResolveAddresses;
	readonly #fetch: FetchAtAddress;
	#addresses: string[] = [];
	#resolvedAt = -Infinity;
	#refresh?: Promise<void>;
	#preferred?: string;
	#rejected = new Map<string, number>();

	constructor(
		hostname: string,
		resolve: ResolveAddresses = resolveIPv4,
		fetchAtAddress: FetchAtAddress = createAddressFetch(hostname),
	) {
		this.#hostname = hostname;
		this.#resolve = resolve;
		this.#fetch = fetchAtAddress;
	}

	async fetch(makeRequest: () => Request, fallback: (request: Request) => Promise<Response>) {
		if (Date.now() - this.#resolvedAt >= DNS_TTL_MS) {
			this.#refresh ??= this.#resolve(this.#hostname)
				.then((addresses) => {
					this.#addresses = [...new Set(addresses)];
					this.#resolvedAt = Date.now();
				})
				.catch(() => {})
				.finally(() => { this.#refresh = undefined; });
			await this.#refresh;
		}
		const now = Date.now();
		for (const [address, until] of this.#rejected) {
			if (until <= now) this.#rejected.delete(address);
		}
		const ordered = this.#addresses.toSorted((a, b) =>
			Number(b === this.#preferred) - Number(a === this.#preferred),
		);
		let lastRejection: Response | undefined;
		let attempts = 0;
		for (const address of ordered) {
			if (attempts >= MAX_ADDRESSES_PER_REQUEST) break;
			if (this.#rejected.has(address)) continue;
			const request = makeRequest();
			request.signal.throwIfAborted();
			attempts++;
			const response = await this.#fetch(request, address);
			if (response.status !== 404 || response.headers.get("server")?.toLowerCase() !== "legy") {
				this.#preferred = address;
				return response;
			}
			const body = await response.arrayBuffer();
			const restored = new Response(body, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
			if (body.byteLength > 0) return restored;
			this.#rejected.set(address, Date.now() + REJECTED_TTL_MS);
			if (this.#preferred === address) this.#preferred = undefined;
			lastRejection = restored;
		}
		if (lastRejection) return lastRejection;
		// An outage can reject the entire pool. Probe one address on a later
		// caller attempt so recovery doesn't have to wait out the quarantine.
		const address = ordered[0];
		if (!address) return fallback(makeRequest());
		const request = makeRequest();
		request.signal.throwIfAborted();
		const response = await this.#fetch(request, address);
		if (response.status === 200) {
			this.#rejected.delete(address);
			this.#preferred = address;
		}
		return response;
	}
}
