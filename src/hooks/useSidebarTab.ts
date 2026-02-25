import { useState } from 'react';

export const useSidebarTab = <T extends string>() => {
	const [activeTab, setActiveTab] = useState<T | null>(null);

	const toggleTab = (tab: T) => {
		setActiveTab(prev => (prev === tab ? null : tab));
	};

	return { activeTab, toggleTab };
};
