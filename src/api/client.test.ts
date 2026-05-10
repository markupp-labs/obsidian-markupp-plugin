import { beforeEach, describe, expect, test, vi } from "vitest";
import { requestUrl } from "obsidian";
import { createNote, getNote, MarkuppApiError, updateNote } from "./client";

vi.mock("obsidian", () => import("../__mocks__/obsidian"));

const mockRequestUrl = vi.mocked(requestUrl);

const noteResponse = {
	id: "abc",
	path: "foo.md",
	content: "hello",
	created_at: "2026-05-06T00:00:00Z",
	updated_at: "2026-05-06T00:00:00Z",
};

describe("createNote", () => {
	beforeEach(() => {
		mockRequestUrl.mockReset();
	});

	test("retorna NoteResponse quando status 201", async () => {
		mockRequestUrl.mockResolvedValue({ status: 201, json: noteResponse });

		const result = await createNote("http://localhost:8080", "foo.md", "hello");

		expect(result).toEqual(noteResponse);
		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: "http://localhost:8080/notes",
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify({ path: "foo.md", content: "hello" }),
			throw: false,
		});
	});

	test("normaliza barras finais da backendUrl", async () => {
		mockRequestUrl.mockResolvedValue({ status: 201, json: {} });

		await createNote("http://localhost:8080///", "foo.md", "x");

		expect(mockRequestUrl).toHaveBeenCalledWith(
			expect.objectContaining({ url: "http://localhost:8080/notes" }),
		);
	});

	test("lança MarkuppApiError com código e mensagem do servidor", async () => {
		mockRequestUrl.mockResolvedValue({
			status: 400,
			json: { error: "invalid_path", message: "caminho ruim" },
		});

		const promise = createNote("http://localhost:8080", "..", "x");

		await expect(promise).rejects.toMatchObject({
			name: "MarkuppApiError",
			code: "invalid_path",
			message: "caminho ruim",
			status: 400,
		});
		await expect(promise).rejects.toBeInstanceOf(MarkuppApiError);
	});

	test("usa código e mensagem default quando body está ausente", async () => {
		mockRequestUrl.mockResolvedValue({ status: 500, json: undefined });

		await expect(
			createNote("http://localhost:8080", "foo.md", "x"),
		).rejects.toMatchObject({
			code: "unknown",
			message: "Erro desconhecido",
			status: 500,
		});
	});
});

describe("updateNote", () => {
	beforeEach(() => {
		mockRequestUrl.mockReset();
	});

	test("retorna NoteResponse quando status 200", async () => {
		mockRequestUrl.mockResolvedValue({ status: 200, json: noteResponse });

		const result = await updateNote(
			"http://localhost:8080",
			"abc",
			"foo.md",
			"hello",
		);

		expect(result).toEqual(noteResponse);
		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: "http://localhost:8080/notes/abc",
			method: "PUT",
			contentType: "application/json",
			body: JSON.stringify({ path: "foo.md", content: "hello" }),
			throw: false,
		});
	});

	test("normaliza barras finais da backendUrl", async () => {
		mockRequestUrl.mockResolvedValue({ status: 200, json: {} });

		await updateNote("http://localhost:8080///", "abc", "foo.md", "x");

		expect(mockRequestUrl).toHaveBeenCalledWith(
			expect.objectContaining({ url: "http://localhost:8080/notes/abc" }),
		);
	});

	test("aplica encodeURIComponent no id", async () => {
		mockRequestUrl.mockResolvedValue({ status: 200, json: {} });

		await updateNote("http://localhost:8080", "a/b", "foo.md", "x");

		expect(mockRequestUrl).toHaveBeenCalledWith(
			expect.objectContaining({ url: "http://localhost:8080/notes/a%2Fb" }),
		);
	});

	test("lança MarkuppApiError com código e mensagem do servidor", async () => {
		mockRequestUrl.mockResolvedValue({
			status: 404,
			json: { error: "not_found", message: "nota não encontrada" },
		});

		await expect(
			updateNote("http://localhost:8080", "x", "foo.md", "y"),
		).rejects.toMatchObject({
			name: "MarkuppApiError",
			code: "not_found",
			status: 404,
		});
	});
});

describe("getNote", () => {
	beforeEach(() => {
		mockRequestUrl.mockReset();
	});

	test("retorna NoteResponse quando status 200", async () => {
		mockRequestUrl.mockResolvedValue({ status: 200, json: noteResponse });

		const result = await getNote("http://localhost:8080", "abc");

		expect(result).toEqual(noteResponse);
		expect(mockRequestUrl).toHaveBeenCalledWith({
			url: "http://localhost:8080/notes/abc",
			method: "GET",
			throw: false,
		});
	});

	test("normaliza barras finais da backendUrl", async () => {
		mockRequestUrl.mockResolvedValue({ status: 200, json: {} });

		await getNote("http://localhost:8080///", "abc");

		expect(mockRequestUrl).toHaveBeenCalledWith(
			expect.objectContaining({ url: "http://localhost:8080/notes/abc" }),
		);
	});

	test("lança MarkuppApiError com código e mensagem do servidor", async () => {
		mockRequestUrl.mockResolvedValue({
			status: 404,
			json: { error: "not_found", message: "nota não encontrada" },
		});

		await expect(
			getNote("http://localhost:8080", "x"),
		).rejects.toMatchObject({
			code: "not_found",
			status: 404,
		});
	});
});
