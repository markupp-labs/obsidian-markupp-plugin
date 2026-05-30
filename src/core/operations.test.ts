import { beforeEach, describe, expect, test, vi } from "vitest";
import * as client from "../api/client";
import type { MarkuppSettings } from "../settings";
import { TFile } from "../__mocks__/obsidian";
import { currentStatus, fetchRemote, pull, push, sync } from "./operations";

vi.mock("obsidian", () => import("../__mocks__/obsidian"));
vi.mock("../api/client", () => ({
	createNote: vi.fn(),
	updateNote: vi.fn(),
	deleteNote: vi.fn(),
	getNote: vi.fn(),
	listNotes: vi.fn(),
	MarkuppApiError: class MarkuppApiError extends Error {},
}));

const createNote = vi.mocked(client.createNote);
const updateNote = vi.mocked(client.updateNote);
const deleteNote = vi.mocked(client.deleteNote);
const getNote = vi.mocked(client.getNote);
const listNotes = vi.mocked(client.listNotes);

beforeEach(() => {
	createNote.mockReset();
	updateNote.mockReset();
	deleteNote.mockReset();
	getNote.mockReset();
	listNotes.mockReset();
});

type FakePluginOpts = {
	files?: { path: string; mtime: number; content?: string }[];
};

function makeFakePlugin(opts: FakePluginOpts = {}) {
	const fileMap = new Map<string, TFile>();
	const contentMap = new Map<string, string>();
	for (const f of opts.files ?? []) {
		const tf = new TFile(f.path, f.mtime);
		fileMap.set(f.path, tf);
		contentMap.set(f.path, f.content ?? "");
	}
	const vault = {
		getMarkdownFiles: () => Array.from(fileMap.values()),
		getAbstractFileByPath: (p: string) => fileMap.get(p) ?? null,
		read: async (f: TFile) => contentMap.get(f.path) ?? "",
		modify: vi.fn(async (f: TFile, content: string) => {
			contentMap.set(f.path, content);
			f.stat.mtime += 1;
		}),
		create: vi.fn(async (p: string, content: string) => {
			const tf = new TFile(p, 9000);
			fileMap.set(p, tf);
			contentMap.set(p, content);
			return tf;
		}),
		createFolder: vi.fn(async () => undefined),
		delete: vi.fn(async (f: TFile) => {
			fileMap.delete(f.path);
		}),
		trash: vi.fn(async (f: TFile) => {
			fileMap.delete(f.path);
		}),
	};
	const plugin = {
		app: { vault },
		saveData: vi.fn().mockResolvedValue(undefined),
	};
	return { plugin, vault, fileMap };
}

function settings(overrides: Partial<MarkuppSettings> = {}): MarkuppSettings {
	return {
		serverUrl: "http://x",
		notes: {},
		lastFetch: { at: "now", remote: {} },
		...overrides,
	};
}

describe("fetchRemote", () => {
	test("atualiza lastFetch.remote a partir do listNotes", async () => {
		const { plugin } = makeFakePlugin();
		const s = settings();
		listNotes.mockResolvedValue([
			{
				id: "1",
				path: "a.md",
				content: "",
				created_at: "T0",
				updated_at: "T1",
			},
		]);

		await fetchRemote(plugin as never, s);

		expect(s.lastFetch?.remote["a.md"]).toEqual({
			id: "1",
			path: "a.md",
			updatedAt: "T1",
		});
		expect(plugin.saveData).toHaveBeenCalled();
	});
});

describe("push", () => {
	test("new_local: chama createNote e popula meta", async () => {
		const { plugin } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 100, content: "hello" }],
		});
		const s = settings();
		createNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "hello",
			created_at: "T0",
			updated_at: "T1",
		});

		const r = await push(plugin as never, s);

		expect(createNote).toHaveBeenCalledWith("http://x", "a.md", "hello");
		expect(r.applied).toBe(1);
		expect(s.notes["a.md"]).toMatchObject({
			id: "id1",
			path: "a.md",
			serverUpdatedAt: "T1",
			localMtimeAtSync: 100,
		});
	});

	test("modified_local: chama updateNote", async () => {
		const { plugin } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 200, content: "v2" }],
		});
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
				},
			},
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T1" } },
			},
		});
		updateNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "v2",
			created_at: "T0",
			updated_at: "T2",
		});

		await push(plugin as never, s);

		expect(updateNote).toHaveBeenCalledWith("http://x", "id1", "a.md", "v2");
		expect(s.notes["a.md"].serverUpdatedAt).toBe("T2");
	});

	test("deleted_local (tombstone): chama deleteNote e remove meta", async () => {
		const { plugin } = makeFakePlugin();
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
					tombstone: true,
				},
			},
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T1" } },
			},
		});
		deleteNote.mockResolvedValue(undefined);

		await push(plugin as never, s);

		expect(deleteNote).toHaveBeenCalledWith("http://x", "id1");
		expect(s.notes["a.md"]).toBeUndefined();
	});

	test("new_local: atualiza lastFetch.remote para status ficar limpo após push", async () => {
		const { plugin } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 100, content: "hello" }],
		});
		const s = settings();
		createNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "hello",
			created_at: "T0",
			updated_at: "T1",
		});

		await push(plugin as never, s);

		expect(s.lastFetch?.remote["a.md"]).toEqual({
			id: "id1",
			path: "a.md",
			updatedAt: "T1",
		});
		// não deve sobrar nenhum diff após o push
		expect(currentStatus(plugin as never, s)).toEqual([]);
	});

	test("modified_local: atualiza lastFetch.remote (sem falso modified_remote)", async () => {
		const { plugin } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 200, content: "v2" }],
		});
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
				},
			},
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T1" } },
			},
		});
		updateNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "v2",
			created_at: "T0",
			updated_at: "T2",
		});

		await push(plugin as never, s);

		expect(s.lastFetch?.remote["a.md"].updatedAt).toBe("T2");
		expect(currentStatus(plugin as never, s)).toEqual([]);
	});

	test("conflict: não chama API, conta como skipped", async () => {
		const { plugin } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 200 }],
		});
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
				},
			},
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T2" } },
			},
		});

		const r = await push(plugin as never, s);

		expect(updateNote).not.toHaveBeenCalled();
		expect(r.applied).toBe(0);
		expect(r.skipped).toBe(1);
	});
});

describe("pull", () => {
	test("new_remote: getNote + create local + meta", async () => {
		const { plugin, fileMap } = makeFakePlugin();
		const s = settings({
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T1" } },
			},
		});
		getNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "remoto",
			created_at: "T0",
			updated_at: "T1",
		});

		await pull(plugin as never, s);

		expect(getNote).toHaveBeenCalledWith("http://x", "id1");
		expect(fileMap.has("a.md")).toBe(true);
		expect(s.notes["a.md"]).toMatchObject({ id: "id1", serverUpdatedAt: "T1" });
	});

	test("deleted_remote: apaga arquivo local e remove meta", async () => {
		const { plugin, vault, fileMap } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 100 }],
		});
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
				},
			},
			lastFetch: { at: "now", remote: {} },
		});

		await pull(plugin as never, s);

		expect(vault.trash).toHaveBeenCalled();
		expect(fileMap.has("a.md")).toBe(false);
		expect(s.notes["a.md"]).toBeUndefined();
	});

	test("deleted_local: pull restaura a nota do servidor e limpa tombstone", async () => {
		const { plugin, fileMap } = makeFakePlugin();
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
					tombstone: true,
				},
			},
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T1" } },
			},
		});
		getNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "do servidor",
			created_at: "T0",
			updated_at: "T1",
		});

		const r = await pull(plugin as never, s);

		expect(getNote).toHaveBeenCalledWith("http://x", "id1");
		expect(fileMap.has("a.md")).toBe(true);
		expect(s.notes["a.md"].tombstone).toBeUndefined();
		expect(r.applied).toBe(1);
		expect(currentStatus(plugin as never, s)).toEqual([]);
	});

	test("modified_remote: vault.modify + meta atualizada", async () => {
		const { plugin, vault } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 100, content: "v1" }],
		});
		const s = settings({
			notes: {
				"a.md": {
					id: "id1",
					path: "a.md",
					serverUpdatedAt: "T1",
					localMtimeAtSync: 100,
				},
			},
			lastFetch: {
				at: "now",
				remote: { "a.md": { id: "id1", path: "a.md", updatedAt: "T2" } },
			},
		});
		getNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "v2",
			created_at: "T0",
			updated_at: "T2",
		});

		await pull(plugin as never, s);

		expect(vault.modify).toHaveBeenCalled();
		expect(s.notes["a.md"].serverUpdatedAt).toBe("T2");
	});
});

describe("sync", () => {
	test("encadeia fetch + pull + push", async () => {
		const { plugin } = makeFakePlugin({
			files: [{ path: "a.md", mtime: 100, content: "local" }],
		});
		const s = settings();
		listNotes.mockResolvedValue([]);
		createNote.mockResolvedValue({
			id: "id1",
			path: "a.md",
			content: "local",
			created_at: "T0",
			updated_at: "T1",
		});

		const r = await sync(plugin as never, s);

		expect(listNotes).toHaveBeenCalled();
		expect(createNote).toHaveBeenCalled();
		expect(r.pushed).toBe(1);
	});
});
