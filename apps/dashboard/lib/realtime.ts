export type ConnectionState = "CONNECTING" | "LIVE" | "RECONNECTING" | "DISCONNECTED";

export function subscribeWithReconnect(
  url: string,
  onMessage: (data: string) => void,
  onState: (state: ConnectionState) => void,
): () => void {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let attempt = 0;

  const connect = () => {
    if (stopped) return;
    onState(attempt === 0 ? "CONNECTING" : "RECONNECTING");
    socket = new WebSocket(url);
    socket.onopen = () => {
      attempt = 0;
      onState("LIVE");
    };
    socket.onmessage = (message) => onMessage(message.data);
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      socket = undefined;
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      timer = setTimeout(connect, delay);
      onState("RECONNECTING");
    };
  };

  connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    socket?.close();
    onState("DISCONNECTED");
  };
}
