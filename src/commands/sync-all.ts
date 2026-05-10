import { Notice, Plugin, TFile } from "obsidian";
import {
	listNotes,
	MarkuppApiError,
	NoteResponse,
} from "../api/client";
import { MarkuppSettings } from "../settings";
import { getNoteMeta, removeNoteMeta } from "../storage/note-index";
import { syncOneFile } from "./sync";

export async function syncAllNotes(
	plugin: Plugin,
	settings: MarkuppSettings,
): Promise<void> {
	const paths = Object.keys(settings.notes);
	if (paths.length === 0) {
		new Notice(
			"Nenhuma nota sincronizada localmente. Use 'Importar do servidor' para começar.",
		);
		return;
	}

	let serverNotes: NoteResponse[];
	try {
		serverNotes = await listNotes(settings.backendUrl);
	} catch (err) {
		new Notice(connectionErrorMessage(err, settings.backendUrl));
		return;
	}

	const serverById = new Map<string, NoteResponse>();
	for (const n of serverNotes) serverById.set(n.id, n);

	const counts = { noop: 0, pulled: 0, pushed: 0, conflict: 0, errors: 0 };
	const conflitos: string[] = [];

	for (const path of paths) {
		const meta = getNoteMeta(settings, path);
		if (!meta) continue;

		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) continue;

		const serverNote = serverById.get(meta.id);
		if (!serverNote) {
			removeNoteMeta(settings, path);
			counts.errors++;
			continue;
		}

		try {
			const result = await syncOneFile(plugin, settings, file, meta, {
				serverNote,
			});
			counts[result]++;
			if (result === "conflict") conflitos.push(path);
		} catch (err) {
			if (
				err instanceof MarkuppApiError &&
				(err.code === "not_found" || err.code === "invalid_id")
			) {
				removeNoteMeta(settings, path);
			}
			counts.errors++;
		}
	}

	await plugin.saveData(settings);

	let msg = `Sincronização: ${counts.noop} sem mudança, ${counts.pulled} baixadas, ${counts.pushed} enviadas`;
	if (counts.conflict > 0) {
		const sample = conflitos.slice(0, 3).join(", ");
		const more = conflitos.length > 3 ? "..." : "";
		msg += `, ${counts.conflict} em conflito (${sample}${more})`;
	}
	if (counts.errors > 0) msg += `, ${counts.errors} com erro`;
	new Notice(msg);
}

function connectionErrorMessage(err: unknown, backendUrl: string): string {
	if (err instanceof MarkuppApiError) {
		return `Erro do servidor (${err.status}): ${err.message}`;
	}
	return `Não foi possível conectar a ${backendUrl}. Verifique se o backend está rodando.`;
}
