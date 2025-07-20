import { isMessageType } from "@mtkruto/mtkruto";
import { HandleFuncResult, HandlerFuncParams } from "./handler.ts";
import { MessageHandler, MessageHandlerParams } from "./message_handler.ts";
import { getReplyMessage } from "../helpers.ts";

import env from "../env.ts";

export interface CommandHandlerFuncParams {
  args: string[];
  input: string;
}

export type CommandHandlerFunc<T extends object> = ({
  client,
  event,
  ...rest
}: HandlerFuncParams & T) => HandleFuncResult;

export interface CommandHandlerParams extends MessageHandlerParams {
  aliases?: string[];
  rawArgs?: boolean;
  // rawInput?: boolean;
}

export class CommandHandler extends MessageHandler<CommandHandlerFuncParams> {
  constructor(
    public name: string,
    public override func: CommandHandlerFunc<CommandHandlerFuncParams>,
    public override params: CommandHandlerParams = {}
  ) {
    super(func, params);
    // this.params.rawInput = this.params.rawInput ?? true;
  }

  override async check({ client, event }: HandlerFuncParams) {
    if (!(await super.check({ client, event }))) {
      return false;
    }
    const { text } = event.msg;
    if (![env.COMMAND_PREFIX, env.INPUT_PREFIX].includes(text[0])) {
      return false;
    }
    const command = text.split(/\s/)[0].slice(1);
    return this.name == command || !!this.params.aliases?.includes(command);
  }

  override async handle({ client, event }: HandlerFuncParams) {
    const { text } = event.msg;
    const args = text // (this.params.rawArgs ? message : text)
      .split("\n")[0]
      .split(/\s/)
      .slice(1);
    let input = "";
    const inputType = text[0];
    const reply = await getReplyMessage(client, event);
    switch (inputType) {
      case env.COMMAND_PREFIX:
        // input = (this.params.rawInput ? message : text)
        input = text.split("\n").slice(1).join("\n").trim();
        break;
      case env.INPUT_PREFIX:
        if (reply && isMessageType(reply, "text")) {
          // input = this.params.rawInput ? reply.message : reply.text;
          input = reply.text;
        }
    }
    await this.func({ client, event, args, input });
  }
}
