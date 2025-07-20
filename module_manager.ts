import * as log from "@std/log";
import { join, resolve, toFileUrl } from "@std/path";
import { isMessageType } from "@mtkruto/mtkruto";

import { bold, fmt } from "./deps.ts";
import { CommandHandler, End, Event } from "./handlers/mod.ts";
import { downloadDocument, getReplyMessage, updateMessage } from "./helpers.ts";
import { getHelp, isModule, Module } from "./module.ts";
import { Client } from "./client.ts";

const externals = "externals";

export function managerModule(manager: ModuleManager): Module {
  return {
    name: "manager",
    handlers: [
      new CommandHandler("install", async ({ client, event, args }) => {
        let spec = args[0] ?? "";
        let path: string | undefined;
        if (!spec) {
          const reply = await getReplyMessage(client, event);

          if (!reply || !isMessageType(reply, "document")) {
            return;
          }

          if (
            reply.document.fileSize > 5000 ||
            !reply.document.fileName.endsWith(".ts")
          ) {
            return;
          }
          const result = await downloadDocument(client, reply);
          if (!result) {
            await updateMessage(
              client,
              event,
              "Could not download the module."
            );
            return;
          }
          path = join(externals, `.${reply.document.fileId}.ts`);
          await Deno.writeTextFile(
            path,
            typeof result === "string" ? result : result.toString()
          );
          spec = ModuleManager.pathToSpec(path);
        }
        let module;
        try {
          module = await ModuleManager.file(spec);
        } catch (_err) {
          await updateMessage(client, event, "Not a module.");
          return;
        }
        if (manager.modules.has(module.name)) {
          await updateMessage(client, event, "Module already installed.");
          return;
        }
        manager.install(module, true);
        if (path) {
          await Deno.rename(path, join(externals, `${module.name}.ts`));
        } else {
          localStorage.setItem(`module_${module.name}`, spec);
        }
        await updateMessage(client, event, "Module installed.");
      }),
      new CommandHandler("uninstall", async ({ client, event, args }) => {
        let uninstalled = 0;
        for (const arg of args) {
          const spec = join("externals", `${arg}.ts`);
          try {
            await Deno.remove(spec);
            manager.uninstall(arg);
            uninstalled++;
          } catch (_err) {
            //
          }
          const key = `module_${arg}`;
          const item = localStorage.getItem(key);
          if (item) {
            localStorage.removeItem(key);
            manager.uninstall(arg);
            uninstalled++;
          }
        }
        await updateMessage(
          client,
          event,
          `${uninstalled <= 0 ? "No" : uninstalled} module${
            uninstalled == 1 ? "" : "s"
          } uninstalled.`
        );
      }),
      new CommandHandler("disable", async ({ client, event, args }) => {
        if (args.length == 0) {
          return;
        }
        let disabled = 0;
        for (const arg of args) {
          const module = manager.modules.get(arg);
          if (module && module[1] && !manager.disabled.has(arg)) {
            manager.disabled.add(arg);
            disabled++;
          }
        }
        await updateMessage(
          client,
          event,
          `${disabled <= 0 ? "No" : disabled} module${
            disabled == 1 ? "" : "s"
          } disabled.`
        );
      }),
      new CommandHandler("enable", async ({ client, event, args }) => {
        if (args.length == 0) {
          return;
        }
        let enabled = 0;
        for (const arg of args) {
          if (manager.disabled.has(arg)) {
            manager.disabled.delete(arg);
            enabled++;
          }
        }
        await updateMessage(
          client,
          event,
          `${enabled <= 0 ? "No" : enabled} module${
            enabled == 1 ? "" : "s"
          } enabled.`
        );
      }),
      new CommandHandler("modules", async ({ event }) => {
        const all = Array.from(manager.modules.values());
        const nonDisableables = all
          .filter(([, disableable]) => !disableable)
          .map(([module]) => module.name);
        const installed = all
          .filter(([, disableable]) => disableable)
          .map(([module]) => module.name);
        let message = "**Built-in**\n";
        for (const module of nonDisableables) {
          message += module + "\n";
        }
        message += "\n**Installed**\n";
        if (installed.length == 0) {
          message += "No modules installed.";
        } else {
          for (const module of installed) {
            message += module + "\n";
          }
        }
        await event.reply(message, { parseMode: "Markdown" });
      }),
      new CommandHandler("help", async ({ client, event, args }) => {
        const name = args[0];
        if (!name) {
          await updateMessage(
            client,
            event,
            "Pass a module name as an argument."
          );
          return;
        }
        const module = manager.modules.get(name);
        if (!module) {
          await updateMessage(client, event, "This module is not installed.");
          return;
        }
        const message = getHelp(module[0]);
        if (!message) {
          await updateMessage(client, event, "This module has no help.");
          return;
        }
        await event.reply(
          typeof message === "string" ? message : message.text,
          {
            parseMode: "Markdown",
            entities:
              typeof message === "string" ? undefined : message.entities,
          }
        );
      }),
    ],
    help: fmt`${bold("Introduction")}

The module manager lets you list the installed modules, get help for them and install external modules.

${bold("Commands")}

- install

Installs an external module from the replied module file.

- uninstall

Uninstalls one or more external modules.

- disable

Disables one or more external modules.

- enable

Enables one or more external modules.

- modules

Lists the installed modules.

- help

Sends the help message of a module if existing.`,
  };
}

export class ModuleManager {
  modules = new Map<string, [Module, boolean]>();

  constructor(private client: Client, public disabled = new Set<string>()) {}

  handler = async (event: Event) => {
    for (const [, [{ name, handlers }, disableable]] of this.modules) {
      if (disableable && this.disabled.has(name)) {
        return;
      }
      for (const [index, handler] of Object.entries(handlers)) {
        if (await handler.check({ client: this.client, event })) {
          try {
            const result = await handler.handle({ client: this.client, event });
            if (typeof result === "symbol" && result == End) {
              break;
            }
          } catch (err) {
            log.error(`handler #${index} of ${name} failed: ${err}`);
            try {
              let message = String(err);
              message = message.length <= 1000 ? message : "An error occurred.";
              await event.reply(message);
            } catch (_err) {
              //
            }
          }
        }
      }
    }
  };

  install(module: Module, disableable = false) {
    if (this.modules.has(module.name)) {
      throw new Error(`Module ${module.name} is already installed`);
    }
    this.modules.set(module.name, [module, disableable]);
  }

  installMultiple(modules: Module[], disableable: boolean) {
    for (const module of modules) {
      this.install(module, disableable);
    }
  }

  uninstall(name: string) {
    return this.modules.delete(name);
  }

  uninstallMultiple(names: string[]) {
    return names.map(this.uninstall);
  }

  uninstallAll() {
    const disableables = new Array<string>();
    for (const [, [{ name }, disableable]] of this.modules) {
      if (disableable) {
        disableables.push(name);
      }
    }
    this.uninstallMultiple(disableables);
  }

  static async file(spec: string) {
    const mod = (await import(spec)).default;
    if (!isModule(mod)) {
      throw new Error("Invalid module");
    }
    return mod;
  }

  static async files(specs: string[]) {
    const modules = new Array<Module>();
    let all = 0;
    for (const spec of specs) {
      try {
        const module = await ModuleManager.file(spec);
        modules.push(module);
      } catch (err) {
        log.warn(`failed to load ${spec}: ${err}`);
      } finally {
        all++;
      }
    }
    log.info(`loaded ${modules.length}/${all} external modules`);
    return modules;
  }

  static pathToSpec(path: string) {
    return toFileUrl(resolve(path)).href;
  }

  static async directory(path: string) {
    const modules = new Array<Module>();
    let all = 0;
    for await (let { name, isFile, isDirectory } of Deno.readDir(path)) {
      if ((!isFile && !isDirectory) || name.startsWith(".")) {
        continue;
      }
      name = name.endsWith(".ts") ? name : `${name}/mod.ts`;
      const filePath = join(path, name);
      try {
        const mod = await ModuleManager.file(
          ModuleManager.pathToSpec(filePath)
        );
        modules.push(mod);
      } catch (err) {
        log.warn(`failed to load ${filePath} from ${path}: ${err}`);
      } finally {
        all++;
      }
    }
    log.info(`loaded ${modules.length}/${all} external modules from ${path}`);
    return modules;
  }
}
