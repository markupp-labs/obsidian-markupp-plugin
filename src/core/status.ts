import type { MarkuppSettings, NoteMeta, RemoteEntry } from "../settings";

export type StatusKind =
	| "new_local"
	| "new_remote"
	| "modified_local"
	| "modified_remote"
	| "deleted_local"
	| "deleted_remote"
	| "conflict";

export type StatusEntry = {
	path: string;
	id?: string;
	kind: StatusKind;
};

export type LocalFile = {
	path: string;
	mtime: number;
};

export function computeStatus(
	localFiles: LocalFile[],
	settings: MarkuppSettings,
): StatusEntry[] {
	const localByPath = new Map<string, LocalFile>();
	for (const f of localFiles) localByPath.set(f.path, f);

	const remote = settings.lastFetch?.remote ?? {};
	const notes = settings.notes;

	const paths = new Set<string>([
		...localByPath.keys(),
		...Object.keys(notes),
		...Object.keys(remote),
	]);

	const out: StatusEntry[] = [];

	for (const path of paths) {
		const local = localByPath.get(path);
		const meta: NoteMeta | undefined = notes[path];
		const rem: RemoteEntry | undefined = remote[path];

		const entry = classify(path, local, meta, rem);
		if (entry) out.push(entry);
	}

	out.sort((a, b) => a.path.localeCompare(b.path));
	return out;
}

function classify(
	path: string,
	local: LocalFile | undefined,
	meta: NoteMeta | undefined,
	remote: RemoteEntry | undefined,
): StatusEntry | null {
	if (!meta) {
		if (local && !remote) return { path, kind: "new_local" };
		if (!local && remote) return { path, id: remote.id, kind: "new_remote" };
		if (local && remote) {
			return { path, id: remote.id, kind: "conflict" };
		}
		return null;
	}

	if (meta.tombstone) {
		if (!remote) return null;
		const remoteChanged = remote.updatedAt !== meta.serverUpdatedAt;
		if (local) return { path, id: meta.id, kind: "conflict" };
		if (remoteChanged) return { path, id: meta.id, kind: "conflict" };
		return { path, id: meta.id, kind: "deleted_local" };
	}

	if (!local) {
		if (!remote) return null;
		const remoteChanged = remote.updatedAt !== meta.serverUpdatedAt;
		if (remoteChanged) return { path, id: meta.id, kind: "conflict" };
		return { path, id: meta.id, kind: "deleted_local" };
	}

	const localChanged = local.mtime !== meta.localMtimeAtSync;

	if (!remote) {
		if (localChanged) return { path, id: meta.id, kind: "conflict" };
		return { path, id: meta.id, kind: "deleted_remote" };
	}

	const remoteChanged = remote.updatedAt !== meta.serverUpdatedAt;

	if (!localChanged && !remoteChanged) return null;
	if (localChanged && !remoteChanged)
		return { path, id: meta.id, kind: "modified_local" };
	if (!localChanged && remoteChanged)
		return { path, id: meta.id, kind: "modified_remote" };
	return { path, id: meta.id, kind: "conflict" };
}

export function collectLocalFiles(app: {
	vault: {
		getMarkdownFiles?: () => { path: string; stat: { mtime: number } }[];
	};
}): LocalFile[] {
	const files = app.vault.getMarkdownFiles?.() ?? [];
	return files.map((f) => ({ path: f.path, mtime: f.stat.mtime }));
}
