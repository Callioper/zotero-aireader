import Addon from "./addon";
import { config } from "../package.json";

// @ts-ignore - Plugin instance is not typed
if (!Zotero[config.addonInstance]) {
  // @ts-ignore - Plugin instance is not typed
  Zotero[config.addonInstance] = new Addon();
  // @ts-ignore - Plugin instance is not typed
  await Zotero[config.addonInstance].hooks.onStartup();
}
