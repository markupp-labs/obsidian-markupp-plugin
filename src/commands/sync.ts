import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import {
	getNote,
	MarkuppApiError,
	NoteResponse,
	updateNote,
} from "../api/client";
import { MarkuppSettings, NoteMeta } from "../settings";
import {
	getNoteMeta,
	removeNoteMeta,
	setNoteMeta,
} from "../storage/note-index";
import { uploadActiveNote } from "./upload";

export type SyncResult = "noop" | "pulled" | "pushed" | "conflict";

export type SyncOptions = {
	serverNote?: NoteResponse;
};

export async function syncOneFile(
	plugin: Plugin,
	settings: MarkuppSettings,
	file: TFile,
	meta: NoteMeta,
	options: SyncOptions = {},
): Promise<SyncResult> {
	const path = file.path;
	const serverNote =
		options.serverNote ?? (await getNote(settings.backendUrl, meta.id));

	const serverChanged = serverNote.updated_at !== meta.serverUpdatedAt;
	const localChanged = file.stat.mtime !== meta.localMtimeAtSync;

	if (!serverChanged && !localChanged) {
		return "noop";
	}

	if (serverChanged && !localChanged) {
		await plugin.app.vault.modify(file, serverNote.content);
		setNoteMeta(settings, path, {
			id: serverNote.id,
			serverUpdatedAt: serverNote.updated_at,
			localMtimeAtSync: file.stat.mtime,
		});
		await plugin.saveData(settings);
		return "pulled";
	}

	if (!serverChanged && localChanged) {
		const content = await plugin.app.vault.read(file);
		const note = await updateNote(settings.backendUrl, meta.id, path, content);
		setNoteMeta(settings, path, {
			id: note.id,
			serverUpdatedAt: note.updated_at,
			localMtimeAtSync: file.stat.mtime,
		});
		await plugin.saveData(settings);
		return "pushed";
	}

	return "conflict";
}

export async function syncActiveNote(
	plugin: Plugin,
	settings: MarkuppSettings,
): Promise<void> {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || !view.file) {
		new Notice("Nenhuma nota ativa");
		return;
	}

	const file = view.file;
	const path = file.path;
	const meta = getNoteMeta(settings, path);

	if (!meta) {
		return uploadActiveNote(plugin, settings);
	}

	try {
		const result = await syncOneFile(plugin, settings, file, meta);
		new Notice(messageFor(result, path));
	} catch (err) {
		if (
			err instanceof MarkuppApiError &&
			(err.code === "not_found" || err.code === "invalid_id")
		) {
			removeNoteMeta(settings, path);
			await plugin.saveData(settings);
		}
		new Notice(buildErrorMessage(err, settings.backendUrl));
	}
}

function messageFor(result: SyncResult, path: string): string {
	switch (result) {
		case "noop":
			return "Já sincronizado.";
		case "pulled":
			return `Atualização do servidor baixada: ${path}`;
		case "pushed":
			return `Alterações locais enviadas: ${path}`;
		case "conflict":
			return "Conflito: nota mudou nos dois lados desde a última sync. Use 'Subir' ou 'Baixar' para escolher.";
	}
}

function buildErrorMessage(err: unknown, backendUrl: string): string {
	if (err instanceof MarkuppApiError) {
		switch (err.code) {
			case "not_found":
				return "Servidor não tem mais essa nota — referência local removida. Use Subir para recriar.";
			case "invalid_id":
				return "Id inválido no servidor — referência local removida.";
			case "invalid_path":
				return `Caminho inválido: ${err.message}`;
			case "invalid_content":
				return `Conteúdo inválido: ${err.message}`;
			default:
				return `Erro do servidor (${err.status}): ${err.message}`;
		}
	}
	return `Não foi possível conectar a ${backendUrl}. Verifique se o backend está rodando.`;
}
