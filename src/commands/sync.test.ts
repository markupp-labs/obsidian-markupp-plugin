import { beforeEach, describe, expect, test, vi } from "vitest";
import * as client from "../api/client";
import * as upload from "./upload";
import type { MarkuppSettings, NoteMeta } from "../settings";
import { makeFakePlugin } from "../__mocks__/fake-plugin";
import { clearNoticeCalls, noticeCalls } from "../__mocks__/obsidian";
import { syncActiveNote } from "./sync";

vi.mock("obsidian", () => import("../__mocks__/obsidian"));
vi.mock("../api/client", async () => {
	const actual =
		await vi.importActual<typeof import("../api/client")>("../api/client");
	return {
		...actual,
		createNote: vi.fn(),
		updateNote: vi.fn(),
		getNote: vi.fn(),
	};
});
vi.mock("./upload", () => ({
	uploadActiveNote: vi.fn(),
}));

const getNote = vi.mocked(client.getNote);
const updateNote = vi.mocked(client.updateNote);
const uploadActiveNote = vi.mocked(upload.uploadActiveNote);

beforeEach(() => {
	getNote.mockReset();
	updateNote.mockReset();
	uploadActiveNote.mockReset();
	clearNoticeCalls();
});

function makeSettings(notes: Record<string, NoteMeta> = {}): MarkuppSettings {
	return { backendUrl: "http://localhost:8080", notes };
}

describe("syncActiveNote", () => {
	test("sem meta: delega para uploadActiveNote", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings();

		await syncActiveNote(plugin as never, settings);

		expect(uploadActiveNote).toHaveBeenCalledWith(plugin, settings);
		expect(getNote).not.toHaveBeenCalled();
	});

	test("nada mudou: Notice 'já sincronizado', nenhuma escrita", async () => {
		const { plugin, vault } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings({
			"foo.md": { id: "id", serverUpdatedAt: "T1", localMtimeAtSync: 1700 },
		});
		getNote.mockResolvedValue({
			id: "id",
			path: "foo.md",
			content: "x",
			created_at: "T0",
			updated_at: "T1",
		});

		await syncActiveNote(plugin as never, settings);

		expect(vault.modify).not.toHaveBeenCalled();
		expect(updateNote).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("Já sincronizado"),
		);
	});

	test("só servidor mudou: vault.modify + meta atualizada", async () => {
		const { plugin, vault, file } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings({
			"foo.md": { id: "id", serverUpdatedAt: "T1", localMtimeAtSync: 1700 },
		});
		getNote.mockResolvedValue({
			id: "id",
			path: "foo.md",
			content: "novo do servidor",
			created_at: "T0",
			updated_at: "T2",
		});

		await syncActiveNote(plugin as never, settings);

		expect(vault.modify).toHaveBeenCalledWith(file, "novo do servidor");
		expect(updateNote).not.toHaveBeenCalled();
		expect(settings.notes["foo.md"]).toEqual({
			id: "id",
			serverUpdatedAt: "T2",
			localMtimeAtSync: file!.stat.mtime,
		});
	});

	test("só local mudou: updateNote chamado + meta atualizada", async () => {
		const { plugin, vault } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
			fileContent: "novo local",
		});
		const settings = makeSettings({
			"foo.md": { id: "id", serverUpdatedAt: "T1", localMtimeAtSync: 1500 },
		});
		getNote.mockResolvedValue({
			id: "id",
			path: "foo.md",
			content: "x",
			created_at: "T0",
			updated_at: "T1",
		});
		updateNote.mockResolvedValue({
			id: "id",
			path: "foo.md",
			content: "novo local",
			created_at: "T0",
			updated_at: "T3",
		});

		await syncActiveNote(plugin as never, settings);

		expect(updateNote).toHaveBeenCalledWith(
			"http://localhost:8080",
			"id",
			"foo.md",
			"novo local",
		);
		expect(vault.modify).not.toHaveBeenCalled();
		expect(settings.notes["foo.md"]).toEqual({
			id: "id",
			serverUpdatedAt: "T3",
			localMtimeAtSync: 1700,
		});
	});

	test("conflito (ambos mudaram): Notice de conflito, nada escrito", async () => {
		const { plugin, vault } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings({
			"foo.md": { id: "id", serverUpdatedAt: "T1", localMtimeAtSync: 1500 },
		});
		getNote.mockResolvedValue({
			id: "id",
			path: "foo.md",
			content: "x",
			created_at: "T0",
			updated_at: "T2",
		});

		await syncActiveNote(plugin as never, settings);

		expect(vault.modify).not.toHaveBeenCalled();
		expect(updateNote).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(settings.notes["foo.md"]).toEqual({
			id: "id",
			serverUpdatedAt: "T1",
			localMtimeAtSync: 1500,
		});
		expect(noticeCalls).toContainEqual(expect.stringContaining("Conflito"));
	});
});
