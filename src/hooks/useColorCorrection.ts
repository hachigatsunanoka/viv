import { useState } from 'react';

export interface ColorCorrection {
	saturation: number;
	contrast: number;
	brightness: number;
	setSaturation: (v: number) => void;
	setContrast: (v: number) => void;
	setBrightness: (v: number) => void;
}

export const useColorCorrection = (): ColorCorrection => {
	const [saturation, setSaturation] = useState(1);
	const [contrast, setContrast] = useState(1);
	const [brightness, setBrightness] = useState(1);
	return { saturation, contrast, brightness, setSaturation, setContrast, setBrightness };
};
