import { config } from "../package.json";
import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "production" | "development";
    initialized?: boolean;
  };
  public hooks: typeof hooks;
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: "production",
      initialized: false,
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;