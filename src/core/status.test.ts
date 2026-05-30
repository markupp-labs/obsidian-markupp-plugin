import { describe, expect, it } from "vitest";
import type { MarkuppSettings } from "../settings";
import { computeStatus, LocalFile } from "./status";

function makeSettings(
	notes: MarkuppSettings["notes"] = {},
	remote: Record<string, { id: string; path: string; updatedAt: string }> = {},
): MarkuppSettings {
	return {
		serverUrl: "http://x",
		notes,
		lastFetch: { at: "now", remote },
	};
}

const local = (path: string, mtime = 1): LocalFile => ({ path, mtime });

describe("computeStatus", () => {
	it("new_local: arquivo no vault, sem meta nem remote", () => {
		const s = makeSettings();
		expect(computeStatus([local("a.md")], s)).toEqual([
			{ path: "a.md", kind: "new_local" },
		]);
	});

	it("new_remote: remote tem path, nada local", () => {
		const s = makeSettings(
			{},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t1" } },
		);
		expect(computeStatus([], s)).toEqual([
			{ path: "a.md", id: "1", kind: "new_remote" },
		]);
	});

	it("synced: mtime e updatedAt iguais à meta → omitido", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
				},
			},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t1" } },
		);
		expect(computeStatus([local("a.md", 10)], s)).toEqual([]);
	});

	it("modified_local: mtime mudou, remote igual à meta", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
				},
			},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t1" } },
		);
		expect(computeStatus([local("a.md", 20)], s)[0].kind).toBe("modified_local");
	});

	it("modified_remote: remote.updatedAt mudou, mtime igual à meta", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
				},
			},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t2" } },
		);
		expect(computeStatus([local("a.md", 10)], s)[0].kind).toBe(
			"modified_remote",
		);
	});

	it("conflict: ambos mudaram", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
				},
			},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t2" } },
		);
		expect(computeStatus([local("a.md", 20)], s)[0].kind).toBe("conflict");
	});

	it("deleted_local: tombstone setado, remote inalterado", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
					tombstone: true,
				},
			},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t1" } },
		);
		expect(computeStatus([], s)[0].kind).toBe("deleted_local");
	});

	it("deleted_remote: meta existe, remote sumiu, local intocado", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
				},
			},
			{},
		);
		expect(computeStatus([local("a.md", 10)], s)[0].kind).toBe(
			"deleted_remote",
		);
	});

	it("conflict: tombstone + remote mudou", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
					tombstone: true,
				},
			},
			{ "a.md": { id: "1", path: "a.md", updatedAt: "t2" } },
		);
		expect(computeStatus([], s)[0].kind).toBe("conflict");
	});

	it("conflict: local modificado + remote sumiu", () => {
		const s = makeSettings(
			{
				"a.md": {
					id: "1",
					path: "a.md",
					serverUpdatedAt: "t1",
					localMtimeAtSync: 10,
				},
			},
			{},
		);
		expect(computeStatus([local("a.md", 20)], s)[0].kind).toBe("conflict");
	});
});
