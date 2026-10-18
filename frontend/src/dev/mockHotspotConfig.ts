/**
 * Development-only switch. Set VITE_USE_MOCK_HOTSPOTS=true in frontend/.env.local
 * to load the isolated synthetic fixture. Backend wiring must continue to pass
 * real GeoJSON through HotspotMap when this is false.
 */
export const isMockHotspotsEnabled = __USE_MOCK_HOTSPOTS__;
export const isDevelopmentEnvironment = import.meta.env.DEV;
