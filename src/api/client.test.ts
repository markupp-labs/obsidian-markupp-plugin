import { beforeEach, describe, expect, test, vi } from "vitest";
import { requestUrl } from "obsidian";
import { createNote, MarkuppApiError } from "./client";

vi.mock("obsidian", () => import("../__mocks__/obsidian"));

const mockRequestUrl = vi.mocked(requestUrl);

describe("createNote", () => {
	beforeEach(() => {
		mockRequestUrl.mockReset();
	});

	test("retorna NoteResponse quando status 201", async () => {
		const note = {
			id: "abc",
			path: "foo.md",
			content: "hello",
			created_at: "2026-05-06T00:00:00Z",
			updated_at: "2026-05-06T00:00:00Z",
		};
		mockRequestUrl.mockResolvedValue({ status: 201, json: note });

		const result = await createNote("http://localhost:8080", "foo.md", "hello");

		expect(result).toEqual(note);
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
