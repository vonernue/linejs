import { rejects } from "node:assert/strict";
import { assert, test } from "vite-plus/test";
import { BaseClient } from "../core/mod.ts";

const fixtureToken = [btoa('{"alg":"none"}'), btoa('{"sub":"fixture"}'), "fixture"].join(".");

for (const path of ["/S4", "/SYNC4"]) {
	test(`default Talk transport sends ${path} over HTTPS and rejects redirects`, async () => {
		const requests: Request[] = [];
		const stop = new Error("fetch fixture reached");
		const client = new BaseClient({
			device: "DESKTOPWIN",
			endpoint: "talk.example.invalid",
			fetch: async (request) => {
				requests.push(request);
				throw stop;
			},
		});
		client.authToken = fixtureToken;

		await rejects(client.request.request([], "noop", 3, false, path), (error) => error === stop);
		assert.deepEqual(requests.length, 1);
		const [request] = requests;
		assert.deepEqual(request.url, `https://talk.example.invalid${path}`);
		assert.deepEqual(request.redirect, "error");
		assert.deepEqual(request.headers.get("x-line-access"), fixtureToken);
		assert.deepEqual(request.headers.has("x-lcs"), false);
	});
}
