/// <reference types="vite/client" />

import type { ApiJjs } from '../../preload/index.js';

declare global {
  interface Window {
    /** Ponte exposta pelo preload. */
    jjs: ApiJjs;
  }
}

export {};
