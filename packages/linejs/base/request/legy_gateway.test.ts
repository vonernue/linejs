import { assert, test } from "vite-plus/test";
import { LegyGateway } from "./legy_gateway.ts";

const makeRequest = () => new Request("https://gf.line.naver.jp/enc", { method: "POST", body: "x" });
const empty404 = () => new Response(null, { status: 404, headers: { server: "legy" } });
const ok = () => new Response("ok", { status: 200 });

function setup(behavior: Record<string, () => Response>, addresses = ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
    const calls: string[] = [];
    let resolves = 0;
    const gateway = new LegyGateway(
        "gf.line.naver.jp",
        () => {
            resolves++;
            return Promise.resolve(addresses);
        },
        (_request, address) => {
            calls.push(address);
            return Promise.resolve(behavior[address]());
        },
    );
    const fallback = () => Promise.resolve(new Response("fallback", { status: 200 }));
    return { gateway, calls, fallback, resolves: () => resolves };
}

test("gateway rotates to another address after an empty legy 404", async () => {
    const { gateway, calls, fallback } = setup({ "1.1.1.1": empty404, "2.2.2.2": ok, "3.3.3.3": ok });
    const response = await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(response.status, 200);
    assert.deepEqual(calls, ["1.1.1.1", "2.2.2.2"]);
});

test("gateway sticks to the working address and avoids the rejected one", async () => {
    const { gateway, calls, fallback } = setup({ "1.1.1.1": empty404, "2.2.2.2": ok, "3.3.3.3": ok });
    await gateway.fetch(makeRequest, fallback);
    await gateway.fetch(makeRequest, fallback);
    await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(calls, ["1.1.1.1", "2.2.2.2", "2.2.2.2", "2.2.2.2"]);
});

test("gateway returns a 404 with a body without rotating", async () => {
    const { gateway, calls, fallback } = setup({
        "1.1.1.1": () => new Response("real", { status: 404, headers: { server: "legy" } }),
        "2.2.2.2": ok,
        "3.3.3.3": ok,
    });
    const response = await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(response.status, 404);
    assert.deepEqual(await response.text(), "real");
    assert.deepEqual(calls, ["1.1.1.1"]);
});

test("gateway does not rotate on 404 from a non-legy server", async () => {
    const { gateway, calls, fallback } = setup({
        "1.1.1.1": () => new Response(null, { status: 404, headers: { server: "other" } }),
        "2.2.2.2": ok,
        "3.3.3.3": ok,
    });
    const response = await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(response.status, 404);
    assert.deepEqual(calls, ["1.1.1.1"]);
});

test("gateway returns the last rejection when every address fails, then probes later", async () => {
    const { gateway, calls, fallback } = setup({
        "1.1.1.1": empty404,
        "2.2.2.2": empty404,
        "3.3.3.3": empty404,
    });
    const first = await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(first.status, 404);
    assert.deepEqual(calls, ["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
    // Everything is quarantined, so the next call probes a single address.
    const second = await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(second.status, 404);
    assert.deepEqual(calls.length, 4);
});

test("gateway falls back to the normal fetcher when DNS yields no addresses", async () => {
    const { gateway, calls, fallback } = setup({}, []);
    const response = await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(await response.text(), "fallback");
    assert.deepEqual(calls, []);
});

test("gateway caches DNS results between requests", async () => {
    const { gateway, resolves, fallback } = setup({ "1.1.1.1": ok, "2.2.2.2": ok, "3.3.3.3": ok });
    await gateway.fetch(makeRequest, fallback);
    await gateway.fetch(makeRequest, fallback);
    assert.deepEqual(resolves(), 1);
});

test("gateway honors an already aborted signal", async () => {
    const { gateway, calls, fallback } = setup({ "1.1.1.1": ok, "2.2.2.2": ok, "3.3.3.3": ok });
    const controller = new AbortController();
    controller.abort();
    let threw = false;
    try {
        await gateway.fetch(
            () => new Request("https://gf.line.naver.jp/enc", { method: "POST", body: "x", signal: controller.signal }),
            fallback,
        );
    } catch {
        threw = true;
    }
    assert.deepEqual(threw, true);
    assert.deepEqual(calls, []);
});
