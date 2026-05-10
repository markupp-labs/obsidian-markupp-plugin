import { beforeEach, describe, expect, test, vi } from "vitest";
import * as client from "../api/client";
import { MarkuppApiError } from "../api/client";
import type { MarkuppSettings, NoteMeta } from "../settings";
import { makeFakePlugin } from "../__mocks__/fake-plugin";
import { clearNoticeCalls, noticeCalls } from "../__mocks__/obsidian";
import { downloadActiveNote } from "./download";

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

const getNote = vi.mocked(client.getNote);

beforeEach(() => {
	getNote.mockReset();
	clearNoticeCalls();
});

function makeSettings(notes: Record<string, NoteMeta> = {}): MarkuppSettings {
	return { backendUrl: "http://localhost:8080", notes };
}

describe("downloadActiveNote", () => {
	test("sem meta: Notice 'use Subir primeiro' e não chama API", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings();

		await downloadActiveNote(plugin as never, settings);

		expect(getNote).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("nunca sincronizada"),
		);
	});

	test("com meta: GET, vault.modify e meta atualizada com mtime pós-modify", async () => {
		const { plugin, vault, file } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings({
			"foo.md": { id: "srv-id", serverUpdatedAt: "old", localMtimeAtSync: 1700 },
		});
		getNote.mockResolvedValue({
			id: "srv-id",
			path: "foo.md",
			content: "from server",
			created_at: "T0",
			updated_at: "T2",
		});

		await downloadActiveNote(plugin as never, settings);

		expect(getNote).toHaveBeenCalledWith("http://localhost:8080", "srv-id");
		expect(vault.modify).toHaveBeenCalledWith(file, "from server");
		expect(settings.notes["foo.md"]).toEqual({
			id: "srv-id",
			serverUpdatedAt: "T2",
			localMtimeAtSync: file!.stat.mtime,
		});
		expect(plugin.saveData).toHaveBeenCalled();
	});

	test("not_found: limpa meta local", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
		});
		const settings = makeSettings({
			"foo.md": { id: "ghost", serverUpdatedAt: "x", localMtimeAtSync: 1500 },
		});
		getNote.mockRejectedValue(
			new MarkuppApiError("not_found", "nota não encontrada", 404),
		);

		await downloadActiveNote(plugin as never, settings);

		expect(settings.notes["foo.md"]).toBeUndefined();
		expect(plugin.saveData).toHaveBeenCalled();
	});

	test("sem nota ativa: Notice e nenhuma chamada de API", async () => {
		const { plugin } = makeFakePlugin({ file: null });
		const settings = makeSettings();

		await downloadActiveNote(plugin as never, settings);

		expect(getNote).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("Nenhuma nota ativa"),
		);
	});
});
