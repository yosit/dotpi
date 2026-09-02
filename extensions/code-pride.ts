/**
 * Before committing code you wrote, re-read it.
 *
 * Tracks code files touched by write/edit. The first `git commit` after those
 * edits is blocked once with a self-review nudge; the retry goes through.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const CODE_EXTENSIONS =
	/\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|rb|java|kt|swift|c|cpp|h|hpp|cs|lua|zig|sh|bash|zsh|vue|svelte|astro|css|scss|html|sql)$/;

const GIT_COMMIT = /\bgit\b[^|;&]*\bcommit\b/;

export default function (pi: ExtensionAPI) {
	const editedPaths = new Set<string>();
	let nudged = false;

	const isBash = (name: string) => name === "bash" || name === "Bash";
	const isFileWrite = (name: string) =>
		name === "write" || name === "Write" || name === "edit" || name === "Edit";

	pi.on("tool_call", async (event) => {
		if (!isBash(event.toolName)) return;

		const cmd = (event.input as { command?: string })?.command ?? "";
		if (!GIT_COMMIT.test(cmd)) return;

		if (nudged || editedPaths.size === 0) {
			// Let it through, and reset for the next round of edits.
			editedPaths.clear();
			nudged = false;
			return;
		}

		nudged = true;
		const paths = [...editedPaths].map((p) => `\`${p}\``).join(", ");
		return {
			block: true,
			reason:
				`You wrote code this turn: ${paths}. ` +
				`Read each of these files FULLY — start to finish, not just your diff — before committing. ` +
				`Is it clean, pristine, and will it make the user proud? ` +
				`Fix anything that isn't, then re-run the commit (it will go through this time).`,
		};
	});

	pi.on("tool_result", async (event) => {
		if (!isFileWrite(event.toolName) || event.isError) return;

		const path = (event.input as { path?: string })?.path ?? "";
		if (CODE_EXTENSIONS.test(path)) {
			editedPaths.add(path);
			nudged = false;
		}
	});
}
