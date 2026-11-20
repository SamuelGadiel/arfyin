export interface PingMessage {
  type: "PING";
}

export interface PongMessage {
  type: "PONG";
  ts: number;
}

export function isPingMessage(message: unknown): message is PingMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "PING"
  );
}

export function buildPong(now: () => number = Date.now): PongMessage {
  return { type: "PONG", ts: now() };
}
