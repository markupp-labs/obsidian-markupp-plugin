import { vi } from "vitest";

export type FakeFile = {
	path: string;
	stat: { mtime: number };
};

export type FakePluginOptions = {
	file?: FakeFile | null;
	fileContent?: string;
};

export function makeFakePlugin(opts: FakePluginOptions = {}) {
	const file =
		opts.file === undefined
			? { path: "default.md", stat: { mtime: 1000 } }
			: opts.file;
	const view = file ? { file } : null;

	const vault = {
		read: vi.fn().mockResolvedValue(opts.fileContent ?? ""),
		modify: vi.fn().mockImplementation(async (f: FakeFile, _: string) => {
			if (f) f.stat.mtime = f.stat.mtime + 1000;
		}),
	};
	const workspace = {
		getActiveViewOfType: vi.fn().mockReturnValue(view),
	};
	const plugin = {
		app: { vault, workspace },
		saveData: vi.fn().mockResolvedValue(undefined),
	};

	return { plugin, vault, workspace, file };
}
