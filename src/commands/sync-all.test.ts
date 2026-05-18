import { beforeEach, describe, expect, test, vi } from "vitest";
import * as client from "../api/client";
import { MarkuppApiError } from "../api/client";
import * as syncMod from "./sync";
import type { MarkuppSettings, NoteMeta } from "../settings";
import { makeFakePlugin } from "../__mocks__/fake-plugin";
import {
	clearNoticeCalls,
	noticeCalls,
	TFile,
} from "../__mocks__/obsidian";
import { syncAllNotes } from "./sync-all";

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
vi.mock("./sync", async () => {
	const actual = await vi.importActual<typeof import("./sync")>("./sync");
	return {
		...actual,
		syncOneFile: vi.fn(),
	};
});

const listNotes = vi.mocked(client.listNotes);
const syncOneFile = vi.mocked(syncMod.syncOneFile);

beforeEach(() => {
	listNotes.mockReset();
	syncOneFile.mockReset();
	clearNoticeCalls();
});

function makeSettings(
	notes: Record<string, NoteMeta>,
): MarkuppSettings {
	return { backendUrl: "http://localhost:8080", notes };
}

describe("syncAllNotes", () => {
	test("sem notas no mapping: Notice avisando, listNotes não é chamado", async () => {
		const { plugin } = makeFakePlugin();
		const settings = makeSettings({});

		await syncAllNotes(plugin as never, settings);

		expect(listNotes).not.toHaveBeenCalled();
		expect(syncOneFile).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("Importe do servidor"),
		);
	});

	test("listNotes rejeita: Notice de conexão", async () => {
		const { plugin } = makeFakePlugin({
			vaultFiles: { "a.md": new TFile("a.md", 1000) },
		});
		const settings = makeSettings({
			"a.md": { id: "a", serverUpdatedAt: "T1", localMtimeAtSync: 1000 },
		});
		listNotes.mockRejectedValue(
			new MarkuppApiError("internal", "erro", 500),
		);

		await syncAllNotes(plugin as never, settings);

		expect(syncOneFile).not.toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("Erro do servidor"),
		);
	});

	test("2 notas no-op: contagens corretas, sem conflito nem erro", async () => {
		const { plugin } = makeFakePlugin({
			vaultFiles: {
				"a.md": new TFile("a.md", 1000),
				"b.md": new TFile("b.md", 1000),
			},
		});
		const settings = makeSettings({
			"a.md": { id: "a", serverUpdatedAt: "T1", localMtimeAtSync: 1000 },
			"b.md": { id: "b", serverUpdatedAt: "T1", localMtimeAtSync: 1000 },
		});
		listNotes.mockResolvedValue([
			{
				id: "a",
				path: "a.md",
				content: "x",
				created_at: "T0",
				updated_at: "T1",
			},
			{
				id: "b",
				path: "b.md",
				content: "y",
				created_at: "T0",
				updated_at: "T1",
			},
		]);
		syncOneFile.mockResolvedValue("noop");

		await syncAllNotes(plugin as never, settings);

		expect(syncOneFile).toHaveBeenCalledTimes(2);
		expect(noticeCalls).toContainEqual(
			expect.stringContaining("2 sem mudança"),
		);
		expect(noticeCalls).not.toContainEqual(
			expect.stringContaining("conflito"),
		);
		expect(noticeCalls).not.toContainEqual(expect.stringContaining("erro"));
	});

	test("conflito: path aparece no Notice", async () => {
		const { plugin } = makeFakePlugin({
			vaultFiles: { "x.md": new TFile("x.md", 1000) },
		});
		const settings = makeSettings({
			"x.md": { id: "x", serverUpdatedAt: "T1", localMtimeAtSync: 1000 },
		});
		listNotes.mockResolvedValue([
			{
				id: "x",
				path: "x.md",
				content: "z",
				created_at: "T0",
				updated_at: "T2",
			},
		]);
		syncOneFile.mockResolvedValue("conflict");

		await syncAllNotes(plugin as never, settings);

		expect(noticeCalls).toContainEqual(
			expect.stringContaining("1 em conflito"),
		);
		expect(noticeCalls).toContainEqual(expect.stringContaining("x.md"));
	});

	test("meta órfã (id sumiu do servidor): meta limpa e contado como erro", async () => {
		const { plugin } = makeFakePlugin({
			vaultFiles: { "fantasma.md": new TFile("fantasma.md", 1000) },
		});
		const settings = makeSettings({
			"fantasma.md": {
				id: "ghost",
				serverUpdatedAt: "T1",
				localMtimeAtSync: 1000,
			},
		});
		listNotes.mockResolvedValue([]);

		await syncAllNotes(plugin as never, settings);

		expect(syncOneFile).not.toHaveBeenCalled();
		expect(settings.notes["fantasma.md"]).toBeUndefined();
		expect(plugin.saveData).toHaveBeenCalled();
		expect(noticeCalls).toContainEqual(expect.stringContaining("1 com erro"));
	});
});
