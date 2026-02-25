export const formatTimestamp = (ts: number): string =>
	new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
