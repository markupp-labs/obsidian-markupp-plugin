import { requestUrl } from "obsidian";

export type NoteResponse = {
	id: string;
	path: string;
	content: string;
	created_at: string;
	updated_at: string;
};

export class MarkuppApiError extends Error {
	constructor(
		public code: string,
		message: string,
		public status: number,
	) {
		super(message);
		this.name = "MarkuppApiError";
	}
}

export async function createNote(
	backendUrl: string,
	path: string,
	content: string,
): Promise<NoteResponse> {
	const url = backendUrl.replace(/\/+$/, "") + "/notes";
	const res = await requestUrl({
		url,
		method: "POST",
		contentType: "application/json",
		body: JSON.stringify({ path, content }),
		throw: false,
	});

	if (res.status === 201) {
		return res.json as NoteResponse;
	}

	const body = res.json as { error?: string; message?: string } | undefined;
	throw new MarkuppApiError(
		body?.error ?? "unknown",
		body?.message ?? "Erro desconhecido",
		res.status,
	);
}
