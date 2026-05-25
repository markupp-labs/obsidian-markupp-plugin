import { beforeEach, describe, expect, test, vi } from "vitest";
import * as client from "../api/client";
import { MarkuppApiError } from "../api/client";
import type { MarkuppSettings, NoteMeta } from "../settings";
import { makeFakePlugin } from "../__mocks__/fake-plugin";
import { clearNoticeCalls, noticeCalls } from "../__mocks__/obsidian";
import { uploadActiveNote } from "./upload";

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

const createNote = vi.mocked(client.createNote);
const updateNote = vi.mocked(client.updateNote);

beforeEach(() => {
	createNote.mockReset();
	updateNote.mockReset();
	clearNoticeCalls();
});

function makeSettings(notes: Record<string, NoteMeta> = {}): MarkuppSettings {
	return { serverUrl: "http://localhost:8080", notes };
}

const baseNoteResponse = {
	id: "srv-id",
	path: "foo.md",
	content: "hi",
	created_at: "2026-05-09T10:00:00Z",
	updated_at: "2026-05-09T10:00:00Z",
};

describe("uploadActiveNote", () => {
	test("sem meta local: cria, salva NoteMeta e mostra Notice de sucesso", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
			fileContent: "hi",
		});
		const settings = makeSettings();
		createNote.mockResolvedValue(baseNoteResponse);

		await uploadActiveNote(plugin as never, settings);

		expect(createNote).toHaveBeenCalledWith(
			"http://localhost:8080",
			"foo.md",
			"hi",
		);
		expect(updateNote).not.toHaveBeenCalled();
		expect(settings.notes["foo.md"]).toEqual({
			id: "srv-id",
			serverUpdatedAt: "2026-05-09T10:00:00Z",
			localMtimeAtSync: 1700,
		});
		expect(plugin.saveData).toHaveBeenCalledWith(settings);
		expect(noticeCalls).toContainEqual(expect.stringContaining("enviada"));
	});

	test("com meta local: chama updateNote e não chama createNote", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
			fileContent: "hi",
		});
		const settings = makeSettings({
			"foo.md": {
				id: "old-id",
				serverUpdatedAt: "old",
				localMtimeAtSync: 1500,
			},
		});
		updateNote.mockResolvedValue({
			...baseNoteResponse,
			id: "old-id",
			updated_at: "new",
		});

		await uploadActiveNote(plugin as never, settings);

		expect(updateNote).toHaveBeenCalledWith(
			"http://localhost:8080",
			"old-id",
			"foo.md",
			"hi",
		);
		expect(createNote).not.toHaveBeenCalled();
		expect(settings.notes["foo.md"]).toEqual({
			id: "old-id",
			serverUpdatedAt: "new",
			localMtimeAtSync: 1700,
		});
	});

	test("not_found em update: limpa meta local e mostra Notice", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
			fileContent: "hi",
		});
		const settings = makeSettings({
			"foo.md": { id: "ghost", serverUpdatedAt: "x", localMtimeAtSync: 1500 },
		});
		updateNote.mockRejectedValue(
			new MarkuppApiError("not_found", "nota não encontrada", 404),
		);

		await uploadActiveNote(plugin as never, settings);

		expect(settings.notes["foo.md"]).toBeUndefined();
		expect(plugin.saveData).toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(expect.stringContaining("Subir"));
	});

	test("duplicate_path em create: Notice mas NÃO salva meta", async () => {
		const { plugin } = makeFakePlugin({
			file: { path: "foo.md", stat: { mtime: 1700 } },
			fileContent: "hi",
		});
		const settings = makeSettings();
		createNote.mockRejectedValue(
			new MarkuppApiError("duplicate_path", "já existe", 409),
		);

		await uploadActiveNote(plugin as never, settings);

		expect(settings.notes["foo.md"]).toBeUndefined();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(expect.stringContaining("Já existe"));
	});

	test("sem nota ativa: Notice e nenhuma chamada de API", async () => {
		const { plugin } = makeFakePlugin({ file: null });
		const settings = makeSettings();

		await uploadActiveNote(plugin as never, settings);

		expect(createNote).not.toHaveBeenCalled();
		expect(updateNote).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("Nenhuma nota ativa"),
		);
	});
});
