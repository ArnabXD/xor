import * as log from "@std/log";
import "@std/dotenv/load";
import { cleanEnv, makeValidator, num, str } from "./deps.ts";

// https://stackoverflow.com/a/54256858/12250600
const PREFIX_REGEX = /^[^\p{L}\d\s@#\$]$/u;

const cmdPrefix = makeValidator((input) => {
  if (PREFIX_REGEX.test(input)) {
    return input;
  }
  log.warn(
    "falling back to '\\' for COMMAND_PREFIX: a single symbol excluding @, # and $ was expected"
  );
  Deno.exit();
  return "\\";
});

const inputPrefix = makeValidator((input) => {
  if (PREFIX_REGEX.test(input) && input !== Deno.env.get("COMMAND_PREFIX")) {
    return input;
  }
  log.warn(
    "falling back to '>' for INPUT_PREFIX: a single symbol excluding @, #, $ and COMMAND_PREFIX was expected"
  );
  return "\\";
});

export default cleanEnv(Deno.env.toObject(), {
  STRING_SESSION: str(),
  APP_ID: num(),
  APP_HASH: str(),
  COMMAND_PREFIX: cmdPrefix({ default: "\\" }),
  INPUT_PREFIX: inputPrefix({ default: ">" }),
});
