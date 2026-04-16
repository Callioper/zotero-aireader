// bootstrap.js - Entry point for the Zotero plugin
// This file is loaded when Zotero starts the plugin

import { init } from "./index";

export default async function bootstrap() {
  await init();
}
