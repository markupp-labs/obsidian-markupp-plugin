import { beforeEach, describe, expect, test, vi } from "vitest";
import * as client from "../api/client";
import { MarkuppApiError } from "../api/client";
import type { MarkuppSettings, NoteMeta } from "../settings";
import { makeFakePlugin } from "../__mocks__/fake-plugin";
import {
	clearNoticeCalls,
	noticeCalls,
	TFile,
} from "../__mocks__/obsidian";
import { importFromServer } from "./import";

vi.mock("obsidian", () => import("../__mocks__/obsidian"));
vi.mock("../api/client", async () => {
	const actual =
		await vi.importActual<typeof import("../api/client")>("../api/client");
	return {
		...actual,
		listNotes: vi.fn(),
		createNote: vi.fn(),
		updateNote: vi.fn(),
		getNote: vi.fn(),
	};
});

const listNotes = vi.mocked(client.listNotes);

beforeEach(() => {
	listNotes.mockReset();
	clearNoticeCalls();
});

function makeSettings(notes: Record<string, NoteMeta> = {}): MarkuppSettings {
	return { backendUrl: "http://localhost:8080", notes };
}

describe("importFromServer", () => {
	test("vault vazio: cria todos os arquivos e popula meta", async () => {
		const { plugin, vault } = makeFakePlugin();
		const settings = makeSettings();
		listNotes.mockResolvedValue([
			{
				id: "a",
				path: "a.md",
				content: "alpha",
				created_at: "T0",
				updated_at: "T1",
			},
			{
				id: "b",
				path: "b.md",
				content: "beta",
				created_at: "T0",
				updated_at: "T1",
			},
		]);

		await importFromServer(plugin as never, settings);

		expect(vault.create).toHaveBeenCalledWith("a.md", "alpha");
		expect(vault.create).toHaveBeenCalledWith("b.md", "beta");
		expect(settings.notes["a.md"]).toMatchObject({
			id: "a",
			serverUpdatedAt: "T1",
		});
		expect(settings.notes["b.md"]).toMatchObject({
			id: "b",
			serverUpdatedAt: "T1",
		});
		expect(plugin.saveData).toHaveBeenCalledWith(settings);
		expect(noticeCalls).toContainEqual(expect.stringContaining("Importadas: 2"));
	});

	test("path já existe localmente: ignora e Notice menciona ignoradas", async () => {
		const existing = new TFile("foo.md", 1000);
		const { plugin, vault } = makeFakePlugin({
			vaultFiles: { "foo.md": existing },
		});
		const settings = makeSettings();
		listNotes.mockResolvedValue([
			{
				id: "a",
				path: "foo.md",
				content: "x",
				created_at: "T0",
				updated_at: "T1",
			},
		]);

		await importFromServer(plugin as never, settings);

		expect(vault.create).not.toHaveBeenCalled();
		expect(settings.notes["foo.md"]).toBeUndefined();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(expect.stringContaining("Importadas: 0"));
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("existiam localmente: 1"),
		);
	});

	test("path com pasta inexistente: createFolder antes de create", async () => {
		const { plugin, vault } = makeFakePlugin();
		const settings = makeSettings();
		listNotes.mockResolvedValue([
			{
				id: "x",
				path: "pasta/sub/nota.md",
				content: "z",
				created_at: "T0",
				updated_at: "T1",
			},
		]);

		await importFromServer(plugin as never, settings);

		expect(vault.createFolder).toHaveBeenCalledWith("pasta/sub");
		expect(vault.create).toHaveBeenCalledWith("pasta/sub/nota.md", "z");
	});

	test("listNotes rejeita: Notice de erro e vault não tocado", async () => {
		const { plugin, vault } = makeFakePlugin();
		const settings = makeSettings();
		listNotes.mockRejectedValue(
			new MarkuppApiError("internal", "erro interno", 500),
		);

		await importFromServer(plugin as never, settings);

		expect(vault.create).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("Erro do servidor"),
		);
	});
});
