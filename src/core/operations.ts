import { Plugin, TFile } from "obsidian";
import {
	createNote,
	deleteNote,
	getNote,
	listNotes,
	MarkuppApiError,
	NoteResponse,
	updateNote,
} from "../api/client";
import { MarkuppSettings, RemoteEntry } from "../settings";
import {
	getNoteMeta,
	removeNoteMeta,
	setNoteMeta,
} from "../storage/note-index";
import { collectLocalFiles, computeStatus, StatusEntry } from "./status";

type PluginLike = Plugin & {
	saveData(data: MarkuppSettings): Promise<void>;
};

export async function fetchRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
): Promise<void> {
	const notes = await listNotes(settings.serverUrl);
	const remote: Record<string, RemoteEntry> = {};
	for (const n of notes) {
		remote[n.path] = { id: n.id, path: n.path, updatedAt: n.updated_at };
	}
	settings.lastFetch = { at: new Date().toISOString(), remote };
	await plugin.saveData(settings);
}

export function currentStatus(
	plugin: PluginLike,
	settings: MarkuppSettings,
): StatusEntry[] {
	return computeStatus(collectLocalFiles(plugin.app), settings);
}

export async function pull(
	plugin: PluginLike,
	settings: MarkuppSettings,
	entries?: StatusEntry[],
): Promise<{ applied: number; skipped: number }> {
	const all = entries ?? currentStatus(plugin, settings);
	let applied = 0;
	let skipped = 0;

	// O saveData fica num finally: se algum apply* lançar no meio do lote, os
	// metas das notas já aplicadas precisam ser persistidos mesmo assim, senão
	// no próximo ciclo elas reaparecem como diff e podem duplicar.
	try {
		for (const e of all) {
			switch (e.kind) {
				case "new_remote":
					await applyNewRemote(plugin, settings, e);
					applied++;
					break;
				case "modified_remote":
					await applyModifiedRemote(plugin, settings, e);
					applied++;
					break;
				case "deleted_remote":
					await applyDeletedRemote(plugin, settings, e);
					applied++;
					break;
				case "deleted_local":
					// Nota deletada localmente mas ainda no servidor: pull traz a
					// cópia do servidor de volta (push é quem confirma a exclusão).
					await applyNewRemote(plugin, settings, e);
					applied++;
					break;
				case "conflict":
					skipped++;
					break;
				default:
					break;
			}
		}
	} finally {
		await plugin.saveData(settings);
	}

	return { applied, skipped };
}

export async function push(
	plugin: PluginLike,
	settings: MarkuppSettings,
	entries?: StatusEntry[],
): Promise<{ applied: number; skipped: number }> {
	const all = entries ?? currentStatus(plugin, settings);
	let applied = 0;
	let skipped = 0;

	try {
		for (const e of all) {
			try {
				switch (e.kind) {
					case "new_local":
						await applyNewLocal(plugin, settings, e);
						applied++;
						break;
					case "modified_local":
						await applyModifiedLocal(plugin, settings, e);
						applied++;
						break;
					case "deleted_local":
						await applyDeletedLocal(plugin, settings, e);
						applied++;
						break;
					case "conflict":
						skipped++;
						break;
					default:
						break;
				}
			} catch (err) {
				// Se a nota mudou no servidor entre o fetch e o push, o update vem
				// com 409. Isso é um conflito a resolver na mão (force push/pull),
				// não um erro que deve abortar o envio das outras notas.
				if (isConflict(err)) {
					skipped++;
					continue;
				}
				throw err;
			}
		}
	} finally {
		await plugin.saveData(settings);
	}

	return { applied, skipped };
}

export async function sync(
	plugin: PluginLike,
	settings: MarkuppSettings,
): Promise<{ pulled: number; pushed: number; conflicts: number }> {
	await fetchRemote(plugin, settings);
	const pulled = await pull(plugin, settings);
	const pushed = await push(plugin, settings);
	return {
		pulled: pulled.applied,
		pushed: pushed.applied,
		conflicts: pulled.skipped,
	};
}

export async function forcePull(
	plugin: PluginLike,
	settings: MarkuppSettings,
	path: string,
): Promise<void> {
	const remote = settings.lastFetch?.remote[path];
	try {
		if (remote) {
			await applyNewRemote(plugin, settings, {
				path,
				id: remote.id,
				kind: "new_remote",
			});
		} else {
			// Sumiu do servidor: o force pull equivale a aceitar a exclusão remota.
			await applyDeletedRemote(plugin, settings, {
				path,
				id: getNoteMeta(settings, path)?.id,
				kind: "deleted_remote",
			});
		}
	} finally {
		await plugin.saveData(settings);
	}
}

export async function forcePush(
	plugin: PluginLike,
	settings: MarkuppSettings,
	path: string,
): Promise<void> {
	const meta = getNoteMeta(settings, path);
	const file = plugin.app.vault.getAbstractFileByPath(path) as TFile | null;
	try {
		if (!file) {
			// Arquivo não existe mais localmente: força a exclusão no servidor.
			await applyDeletedLocal(plugin, settings, {
				path,
				id: meta?.id,
				kind: "deleted_local",
			});
		} else if (meta?.id && !meta.tombstone) {
			// Já conhecida pelo servidor: reaproveita o update, mas com force pra
			// vencer o optimistic locking e sobrescrever a versão remota.
			await applyModifiedLocal(
				plugin,
				settings,
				{ path, id: meta.id, kind: "modified_local" },
				true,
			);
		} else {
			await applyNewLocal(plugin, settings, { path, kind: "new_local" });
		}
	} finally {
		await plugin.saveData(settings);
	}
}

function isConflict(err: unknown): boolean {
	return err instanceof MarkuppApiError && err.status === 409;
}

/**
 * Mantém o snapshot `lastFetch.remote` coerente com o que o servidor acabou de
 * confirmar num push, evitando que a próxima leitura de status acuse a nota
 * recém-enviada como modificada/deletada remotamente.
 */
function syncRemoteSnapshot(
	settings: MarkuppSettings,
	path: string,
	id: string,
	updatedAt: string,
): void {
	if (!settings.lastFetch) return;
	settings.lastFetch.remote[path] = { id, path, updatedAt };
}

/**
 * Registra que `path` está em dia com o servidor: grava o meta local e alinha o
 * snapshot remoto com a resposta recém-recebida. Centraliza o par
 * setNoteMeta + syncRemoteSnapshot que todo apply* precisa fazer ao final.
 */
function recordSynced(
	settings: MarkuppSettings,
	path: string,
	note: NoteResponse,
	mtime: number,
): void {
	setNoteMeta(settings, path, {
		id: note.id,
		path,
		serverUpdatedAt: note.updated_at,
		localMtimeAtSync: mtime,
	});
	syncRemoteSnapshot(settings, path, note.id, note.updated_at);
}

async function applyNewLocal(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (!file) return;
	const content = await plugin.app.vault.read(file);
	const note = await createNote(settings.serverUrl, e.path, content);
	recordSynced(settings, e.path, note, file.stat.mtime);
}

async function applyModifiedLocal(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
	force = false,
): Promise<void> {
	const meta = getNoteMeta(settings, e.path);
	if (!meta) return;
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (!file) return;
	const content = await plugin.app.vault.read(file);
	const note = await updateNote(settings.serverUrl, meta.id, e.path, content, {
		lastModifiedAt: meta.serverUpdatedAt,
		force,
	});
	recordSynced(settings, e.path, note, file.stat.mtime);
}

async function applyDeletedLocal(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const meta = getNoteMeta(settings, e.path);
	if (!meta) return;
	try {
		await deleteNote(settings.serverUrl, meta.id);
	} catch (err) {
		// tolerate already-gone
		console.error("Markupp deleteNote", err);
	}
	removeNoteMeta(settings, e.path);
	if (settings.lastFetch) delete settings.lastFetch.remote[e.path];
}

async function applyNewRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	if (!e.id) return;
	const note = await getNote(settings.serverUrl, e.id);
	await writeFile(plugin, e.path, note.content);
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	recordSynced(settings, e.path, note, file?.stat.mtime ?? 0);
}

async function applyModifiedRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	if (!e.id) return;
	const note = await getNote(settings.serverUrl, e.id);
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (file) {
		await plugin.app.vault.modify(file, note.content);
	} else {
		await writeFile(plugin, e.path, note.content);
	}
	const fresh = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	recordSynced(settings, e.path, note, fresh?.stat.mtime ?? 0);
}

async function applyDeletedRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (file) {
		const vault = plugin.app.vault as unknown as {
			delete?: (f: TFile) => Promise<void>;
			trash?: (f: TFile, system: boolean) => Promise<void>;
		};
		if (vault.trash) {
			await vault.trash(file, false);
		} else if (vault.delete) {
			await vault.delete(file);
		}
	}
	removeNoteMeta(settings, e.path);
}

async function writeFile(
	plugin: PluginLike,
	path: string,
	content: string,
): Promise<void> {
	await ensureParentFolders(plugin, path);
	const existing = plugin.app.vault.getAbstractFileByPath(path) as TFile | null;
	if (existing) {
		await plugin.app.vault.modify(existing, content);
	} else {
		await plugin.app.vault.create(path, content);
	}
}

/**
 * Garante que todas as pastas do caminho existam antes de criar a nota,
 * criando cada nível que ainda não existe. O servidor guarda apenas o path
 * (ex.: "projetos/ideias/nota.md"); as pastas são derivadas dele no pull.
 */
async function ensureParentFolders(
	plugin: PluginLike,
	path: string,
): Promise<void> {
	const slash = path.lastIndexOf("/");
	if (slash <= 0) return;
	const segments = path.slice(0, slash).split("/");
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (plugin.app.vault.getAbstractFileByPath(current)) continue;
		try {
			await plugin.app.vault.createFolder(current);
		} catch (err) {
			// Corrida: a pasta pode ter sido criada nesse meio tempo. Só
			// propaga o erro se ela realmente continuar ausente.
			if (!plugin.app.vault.getAbstractFileByPath(current)) throw err;
		}
	}
}
