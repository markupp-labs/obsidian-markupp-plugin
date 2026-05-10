import { describe, expect, test } from "vitest";
import {
	getNoteMeta,
	removeNoteMeta,
	renameNote,
	setNoteMeta,
} from "./note-index";
import type { MarkuppSettings, NoteMeta } from "../settings";

function emptySettings(): MarkuppSettings {
	return { backendUrl: "http://localhost:8080", notes: {} };
}

const meta: NoteMeta = {
	id: "abc",
	serverUpdatedAt: "2026-05-09T00:00:00Z",
	localMtimeAtSync: 1234567890,
};

describe("note-index", () => {
	test("setNoteMeta + getNoteMeta round-trip", () => {
		const settings = emptySettings();
		setNoteMeta(settings, "foo.md", meta);

		expect(getNoteMeta(settings, "foo.md")).toEqual(meta);
	});

	test("getNoteMeta retorna undefined para chave inexistente", () => {
		expect(getNoteMeta(emptySettings(), "x.md")).toBeUndefined();
	});

	test("removeNoteMeta apaga entrada existente", () => {
		const settings = emptySettings();
		setNoteMeta(settings, "foo.md", meta);

		removeNoteMeta(settings, "foo.md");

		expect(getNoteMeta(settings, "foo.md")).toBeUndefined();
	});

	test("removeNoteMeta em chave inexistente é no-op", () => {
		const settings = emptySettings();

		expect(() => removeNoteMeta(settings, "fantasma.md")).not.toThrow();
		expect(settings.notes).toEqual({});
	});

	test("renameNote move entrada e remove a chave antiga", () => {
		const settings = emptySettings();
		setNoteMeta(settings, "old.md", meta);

		renameNote(settings, "old.md", "new.md");

		expect(getNoteMeta(settings, "old.md")).toBeUndefined();
		expect(getNoteMeta(settings, "new.md")).toEqual(meta);
	});

	test("renameNote é no-op se origem não existe", () => {
		const settings = emptySettings();

		renameNote(settings, "fantasma.md", "novo.md");

		expect(settings.notes).toEqual({});
	});
});
