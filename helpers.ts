import { SendMessageParams, Client, MessageDocument } from "@mtkruto/mtkruto";
import { Event } from "./handlers/mod.ts";
import { fmt, type Stringable } from "./deps.ts";

export function updateMessage(client: Client, event: Event, text: Stringable) {
  const msg = fmt`${event.msg.text}\n${text}`;
  return client.editMessageText(event.msg.chat.id, event.msg.id, msg.text, {
    entities: msg.entities,
  });
}

export function getReplyMessage(client: Client, event: Event) {
  if (event.msg.replyToMessageId) {
    return client.getMessage(event.chat.id, event.msg.replyToMessageId);
  }
  return null;
}

export function downloadDocument(client: Client, doc: MessageDocument) {
  return client.download(doc.document.fileId);
}

export function longText(_text: string, _name?: string): SendMessageParams {
  // return text.length > 4096
  //   ? {

  //     }
  //   : pre(text.trim(), "").send;
  return {};
}
