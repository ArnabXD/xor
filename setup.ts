import * as log from "@std/log";
import { getLevelByName } from "@std/log/levels";
// import { setup } from "pls";

const level = (() => {
  let toReturn = "INFO";
  try {
    const level = Deno.env.get("LOG_LEVEL");
    if (level) {
      // deno-lint-ignore no-explicit-any
      getLevelByName(level as any);
      toReturn = level;
    }
  } catch (_err) {
    //
  }
  return toReturn as log.LevelName;
})();

log.setup({
  handlers: {
    console: new log.ConsoleHandler(level),
    file: new log.FileHandler(level, {
      filename: ".log",
      mode: "a",
    }),
  },
  loggers: {
    default: {
      handlers: ["console", "file"],
    },
  },
});

// let connected = false;

// if (Deno.env.get("PLS_CONNECTION_URI")) {
//   try {
//     await setup({ include: [/^module_/] });
//     connected = true;
//   } catch (err) {
//     log.warn(`could not connect to the database: ${err}`);
//   }
// }

// if (connected) {
//   log.info("connected to the database");
// } else {
//   log.info("not using database");
// }
