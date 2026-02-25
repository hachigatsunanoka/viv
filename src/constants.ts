// Zoom
export const ZOOM_SENSITIVITY = 0.0001;
export const ZOOM_SENSITIVITY_WHEEL = 0.001;
export const ZOOM_SENSITIVITY_DRAG = 0.002;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
export const FOCUS_ZOOM_MAX = 2;
export const FOCUS_PADDING = 50;

// Node sizing
export const BACKDROP_INIT_PADDING = 50;
export const TEXT_SIZE_FONT_MAP: Record<'small' | 'medium' | 'large', number> = {
	small: 14,
	medium: 24,
	large: 40,
};

// Connection snapping
export const SNAP_THRESHOLD_WORLD = 60;

// Alignment / bin packing
export const ALIGNMENT_SEARCH_STEPS = 60;

// Canvas / Annotation
export const GRUNGE_TEXTURE_SIZE = 512;
export const GRUNGE_SCRATCH_COUNT = 800;

// Media
export const NORMALIZE_TARGET_SIZE = 500;

// Video
export const DEFAULT_FPS = 24;
export const EPSILON = 0.00001;
