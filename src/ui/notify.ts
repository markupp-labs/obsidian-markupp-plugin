import { Notice } from "obsidian";

type OpResult = {
	applied?: number;
	skipped?: number;
	pulled?: number;
	pushed?: number;
	conflicts?: number;
};

export function notifyResult(
	op: "fetch" | "pull" | "push" | "sync",
	result: OpResult,
): void {
	if (op === "fetch") {
		new Notice("Markupp: fetch concluído.");
		return;
	}
	if (op === "sync") {
		const r = result as { pulled: number; pushed: number; conflicts: number };
		new Notice(
			`Markupp sync: ${r.pulled} baixadas, ${r.pushed} enviadas, ${r.conflicts} conflitos.`,
		);
		return;
	}
	const r = result as { applied: number; skipped: number };
	new Notice(`Markupp ${op}: ${r.applied} aplicadas, ${r.skipped} conflitos.`);
}
