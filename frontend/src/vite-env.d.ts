
/// <reference types="vite/client" />

declare const __USE_MOCK_HOTSPOTS__: boolean;



declare module "*.css" {
  const css: string;
  export default css;
}
