/** VER 3.71.2 — 徹底根治 Rapier WASM 啟動錯誤：移除 index.html 歷史冗餘動態載入 fallback 腳本（杜絕雙重實例衝突）、啟用 index-[hash].js 破除瀏覽器/CDN快取、靜態引入並於 boot() 最先確保 initPhysics() 完畢。 */
export const APP_VERSION = 'VER 3.71.2'
