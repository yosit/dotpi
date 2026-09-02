/**
 * The extension is a pure event machine: it only reads `tool_call` and
 * `tool_result` events and returns a block decision. That makes it testable
 * with a fake ExtensionAPI and no pi process.
 *
 * The `ExtensionAPI` import in the extension is `import type`, so it is erased
 * at runtime and nothing needs to be installed to run these.
 */
import { describe, expect, test } from "bun:test";
import codePride from "../extensions/code-pride.ts";

type BlockResult = { block: true; reason: string } | undefined;
type Handler = (event: unknown) => Promise<BlockResult>;

/**
 * Drives one extension instance. Each `harness()` is an independent session.
 */
function harness() {
	const handlers: Record<string, Handler[]> = {};
	const pi = {
		on(name: string, handler: Handler) {
			(handlers[name] ??= []).push(handler);
		},
	};
	codePride(pi as never);

	const emit = async (name: string, event: unknown): Promise<BlockResult> => {
		for (const handler of handlers[name] ?? []) {
			const result = await handler(event);
			if (result) return result;
		}
		return undefined;
	};

	return {
		/** Simulate a successful write/edit of `path`. */
		edit: (path: string, toolName = "edit") =>
			emit("tool_result", { toolName, input: { path }, isError: false }),
		/** Simulate a failed write/edit of `path`. */
		failedEdit: (path: string) =>
			emit("tool_result", { toolName: "edit", input: { path }, isError: true }),
		/** Simulate a bash tool call. Resolves to the block result, if any. */
		bash: (command: string, toolName = "bash") =>
			emit("tool_call", { toolName, input: { command } }),
	};
}

const CODE = "src/app.ts";

describe("no edits", () => {
	test("a commit with nothing written is not blocked", async () => {
		const h = harness();
		expect(await h.bash("git commit -m 'wip'")).toBeUndefined();
	});

	test("a commit after a doc-only edit is not blocked", async () => {
		const h = harness();
		await h.edit("README.md");
		expect(await h.bash("git commit -m 'docs'")).toBeUndefined();
	});

	test("a failed edit is not tracked", async () => {
		const h = harness();
		await h.failedEdit(CODE);
		expect(await h.bash("git commit -m 'wip'")).toBeUndefined();
	});
});

describe("block once, then allow", () => {
	test("first commit after a code edit is blocked", async () => {
		const h = harness();
		await h.edit(CODE);
		const result = await h.bash("git commit -m 'wip'");
		expect(result?.block).toBe(true);
	});

	test("the block names every edited file", async () => {
		const h = harness();
		await h.edit("src/a.ts");
		await h.edit("src/b.py", "write");
		const result = await h.bash("git commit -m 'wip'");
		expect(result?.reason).toContain("`src/a.ts`");
		expect(result?.reason).toContain("`src/b.py`");
	});

	test("the same path edited twice is named once", async () => {
		const h = harness();
		await h.edit(CODE);
		await h.edit(CODE);
		const result = await h.bash("git commit -m 'wip'");
		expect(result?.reason.match(/`src\/app\.ts`/g)).toHaveLength(1);
	});

	test("a bare retry goes through", async () => {
		const h = harness();
		await h.edit(CODE);
		expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
		expect(await h.bash("git commit -m 'wip'")).toBeUndefined();
	});

	test("the allowed commit clears state, so the next commit is also allowed", async () => {
		const h = harness();
		await h.edit(CODE);
		await h.bash("git commit -m 'wip'"); // blocked
		await h.bash("git commit -m 'wip'"); // allowed, clears
		expect(await h.bash("git commit -m 'more'")).toBeUndefined();
	});

	test("a fresh edit after an allowed commit arms the guard again", async () => {
		const h = harness();
		await h.edit("src/a.ts");
		await h.bash("git commit -m 'one'"); // blocked
		await h.bash("git commit -m 'one'"); // allowed
		await h.edit("src/b.ts");
		const result = await h.bash("git commit -m 'two'");
		expect(result?.block).toBe(true);
		expect(result?.reason).toContain("`src/b.ts`");
		// State was cleared by the allowed commit, so the old file is not named.
		expect(result?.reason).not.toContain("`src/a.ts`");
	});
});

describe("re-arming on a fix", () => {
	test("editing during review blocks the retry as well", async () => {
		const h = harness();
		await h.edit(CODE);
		expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
		await h.edit(CODE); // the review found something
		expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
	});

	test("a review pass that changes nothing terminates the loop", async () => {
		const h = harness();
		await h.edit(CODE);
		expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
		await h.edit(CODE); // fix
		expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
		// Second review found nothing, so no edit — the retry goes through.
		expect(await h.bash("git commit -m 'wip'")).toBeUndefined();
	});

	test("a doc edit during review does not re-arm the guard", async () => {
		const h = harness();
		await h.edit(CODE);
		expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
		await h.edit("NOTES.md");
		expect(await h.bash("git commit -m 'wip'")).toBeUndefined();
	});
});

describe("command matching", () => {
	const blocking = [
		"git commit -m 'wip'",
		"git commit",
		'git -C /some/repo commit -m "x"',
		"git commit -am 'wip' --no-verify",
		"cd /repo && git commit -m 'wip'",
		"git add . ; git commit -m 'wip'",
	];
	for (const command of blocking) {
		test(`blocks: ${command}`, async () => {
			const h = harness();
			await h.edit(CODE);
			expect((await h.bash(command))?.block).toBe(true);
		});
	}

	const passing = [
		"git status",
		"git log --oneline -5",
		"git add .",
		"git show --stat HEAD",
		// "commit" not reachable from a `git` token without crossing a separator
		"git log | grep commit",
	];
	for (const command of passing) {
		test(`allows: ${command}`, async () => {
			const h = harness();
			await h.edit(CODE);
			expect(await h.bash(command)).toBeUndefined();
		});
	}

	test("a non-bash tool call is ignored", async () => {
		const h = harness();
		await h.edit(CODE);
		expect(await h.bash("git commit -m 'wip'", "read")).toBeUndefined();
	});

	test("capitalized tool names are handled", async () => {
		const h = harness();
		await h.edit(CODE, "Write");
		expect((await h.bash("git commit -m 'wip'", "Bash"))?.block).toBe(true);
	});

	test("a missing command field does not throw", async () => {
		const h = harness();
		await h.edit(CODE);
		expect(await h.bash(undefined as never)).toBeUndefined();
	});
});

describe("tracked extensions", () => {
	const tracked = ["a.ts", "a.tsx", "a.py", "a.rs", "a.go", "a.sh", "a.sql", "a.css", "a.svelte"];
	for (const path of tracked) {
		test(`tracks ${path}`, async () => {
			const h = harness();
			await h.edit(path);
			expect((await h.bash("git commit -m 'wip'"))?.block).toBe(true);
		});
	}

	const ignored = ["a.md", "a.json", "a.txt", "a.yaml", "a.lock", "Makefile"];
	for (const path of ignored) {
		test(`ignores ${path}`, async () => {
			const h = harness();
			await h.edit(path);
			expect(await h.bash("git commit -m 'wip'")).toBeUndefined();
		});
	}
});
