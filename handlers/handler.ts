import { Client as MTKrutoClient, Context, WithFilter } from "$mtkruto";

export type NewMessageEvent = WithFilter<Context, "message:text">;
export type EditedMessageEvent = WithFilter<Context, "editedMessage:text">;

export const End = Symbol();

export type Event = NewMessageEvent | EditedMessageEvent;

export type HandleFuncResult = Promise<void | typeof End>;

export interface HandlerFuncParams {
  client: MTKrutoClient;
  event: Event;
}

export abstract class Handler {
  abstract check({
    client,
    event,
  }: HandlerFuncParams): Promise<boolean> | boolean;

  abstract handle({ client, event }: HandlerFuncParams): HandleFuncResult;
}
