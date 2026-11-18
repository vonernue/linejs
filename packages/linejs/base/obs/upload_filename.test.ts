import { Buffer } from "node:buffer";
import { assert, test } from "vite-plus/test";
import { BaseClient } from "../core/mod.ts";
import { MemoryStorage } from "../storage/mod.ts";

test("Talk file uploads preserve Unicode filenames in OBS parameters", async () => {
	const filename = "課表.xlsx";
	const payload = new Blob(["fixture"]);
	const chatId = "c00000000000000000000000000000000";
	const client = new BaseClient({
		device: "DESKTOPWIN",
		storage: new MemoryStorage(),
		fetch: async (input, init) => {
			const request = new Request(input, init);
			const header = request.headers.get("X-Obs-Params");
			assert.isNotNull(header);
			const params = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
			assert.strictEqual(params.name, filename);
			assert.strictEqual(params.tomid, chatId);
			assert.strictEqual(await request.text(), "fixture");
			return new Response(null, { headers: { "x-obs-oid": "fixture-id" } });
		},
	});
	client.authToken = "offline-fixture";
	const result = await client.obs.uploadObjTalk(chatId, "file", payload, undefined, filename);
	assert.strictEqual(result.objId, "fixture-id");
});
