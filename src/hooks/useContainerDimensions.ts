import { useState, useEffect, type RefObject } from 'react';

export const useContainerDimensions = (ref: RefObject<HTMLElement | null>) => {
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const updateDimensions = () => {
			if (ref.current) {
				setDimensions({
					width: ref.current.clientWidth,
					height: ref.current.clientHeight
				});
			}
		};

		updateDimensions();
		window.addEventListener('resize', updateDimensions);
		return () => window.removeEventListener('resize', updateDimensions);
	}, [ref]);

	return dimensions;
};
