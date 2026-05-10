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

function notesUrl(backendUrl: string, suffix = ""): string {
	return backendUrl.replace(/\/+$/, "") + "/notes" + suffix;
}

function toApiError(res: { status: number; json: unknown }): MarkuppApiError {
	const body = res.json as { error?: string; message?: string } | undefined;
	return new MarkuppApiError(
		body?.error ?? "unknown",
		body?.message ?? "Erro desconhecido",
		res.status,
	);
}

export async function createNote(
	backendUrl: string,
	path: string,
	content: string,
): Promise<NoteResponse> {
	const res = await requestUrl({
		url: notesUrl(backendUrl),
		method: "POST",
		contentType: "application/json",
		body: JSON.stringify({ path, content }),
		throw: false,
	});

	if (res.status === 201) {
		return res.json as NoteResponse;
	}
	throw toApiError(res);
}

export async function updateNote(
	backendUrl: string,
	id: string,
	path: string,
	content: string,
): Promise<NoteResponse> {
	const res = await requestUrl({
		url: notesUrl(backendUrl, "/" + encodeURIComponent(id)),
		method: "PUT",
		contentType: "application/json",
		body: JSON.stringify({ path, content }),
		throw: false,
	});

	if (res.status === 200) {
		return res.json as NoteResponse;
	}
	throw toApiError(res);
}

export async function getNote(
	backendUrl: string,
	id: string,
): Promise<NoteResponse> {
	const res = await requestUrl({
		url: notesUrl(backendUrl, "/" + encodeURIComponent(id)),
		method: "GET",
		throw: false,
	});

	if (res.status === 200) {
		return res.json as NoteResponse;
	}
	throw toApiError(res);
}
