import { vi } from "vitest";
import { TAbstractFile, TFile, TFolder } from "./obsidian";

export type FakeFile = {
	path: string;
	stat: { mtime: number };
};

export type FakePluginOptions = {
	file?: FakeFile | null;
	fileContent?: string;
	vaultFiles?: Record<string, TAbstractFile>;
};

export function makeFakePlugin(opts: FakePluginOptions = {}) {
	const file =
		opts.file === undefined
			? { path: "default.md", stat: { mtime: 1000 } }
			: opts.file;
	const view = file ? { file } : null;

	const vaultFiles = new Map<string, TAbstractFile>(
		Object.entries(opts.vaultFiles ?? {}),
	);

	const vault = {
		read: vi.fn().mockResolvedValue(opts.fileContent ?? ""),
		modify: vi.fn().mockImplementation(async (f: FakeFile | TFile, _: string) => {
			if (f) f.stat.mtime = f.stat.mtime + 1000;
		}),
		getAbstractFileByPath: vi
			.fn()
			.mockImplementation((path: string) => vaultFiles.get(path) ?? null),
		create: vi
			.fn()
			.mockImplementation(async (path: string, _content: string) => {
				const tfile = new TFile(path, 5000);
				vaultFiles.set(path, tfile);
				return tfile;
			}),
		createFolder: vi.fn().mockImplementation(async (path: string) => {
			const tfolder = new TFolder(path);
			vaultFiles.set(path, tfolder);
			return tfolder;
		}),
	};
	const workspace = {
		getActiveViewOfType: vi.fn().mockReturnValue(view),
	};
	const plugin = {
		app: { vault, workspace },
		saveData: vi.fn().mockResolvedValue(undefined),
	};

	return { plugin, vault, workspace, file, vaultFiles };
}
