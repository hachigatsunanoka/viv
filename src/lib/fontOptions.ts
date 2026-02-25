export interface FontChoice {
	id: string;
	label: string;
	stack: string;
}

export const SANS_FONTS: FontChoice[] = [
	{ id: 'system',    label: 'System UI',   stack: 'system-ui, sans-serif' },
	{ id: 'inter',     label: 'Inter',       stack: "'Inter', system-ui, sans-serif" },
	{ id: 'noto-sans', label: 'Noto Sans',   stack: "'Noto Sans', 'Noto Sans JP', sans-serif" },
];

export const MONO_FONTS: FontChoice[] = [
	{ id: 'system-mono', label: 'System Mono',    stack: 'monospace' },
	{ id: 'jetbrains',   label: 'JetBrains Mono', stack: "'JetBrains Mono', monospace" },
	{ id: 'noto-mono',   label: 'Noto Sans Mono', stack: "'Noto Sans Mono', monospace" },
];

export function applyFonts(sansId: string, monoId: string): void {
	const sans = SANS_FONTS.find(f => f.id === sansId) ?? SANS_FONTS[0];
	const mono = MONO_FONTS.find(f => f.id === monoId) ?? MONO_FONTS[0];
	document.documentElement.style.setProperty('--font-node-sans', sans.stack);
	document.documentElement.style.setProperty('--font-node-mono', mono.stack);
}
