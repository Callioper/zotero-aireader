import { ZoteroToolkit } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export function createZToolkit() {
  const ztoolkit = new ZoteroToolkit();
  ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  ztoolkit.basicOptions.api.pluginID = config.addonID;
  ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/favicon.png`,
  );
  return ztoolkit;
}
