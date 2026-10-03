export type ConnectionState = "CONNECTING" | "LIVE" | "RECONNECTING" | "DISCONNECTED";
export type TokenProvider = () => Promise<string | null>;

/**
 * Subscribe to an authenticated WebSocket and reconnect with bounded backoff.
 * The token is fetched before each connection and sent as the first message;
 * credentials never appear in the URL.
 */
export function subscribeWithReconnect(
  url: string,
  getToken: TokenProvider,
  onMessage: (data: string) => void,
  onState: (state: ConnectionState) => void,
): () => void {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let attempt = 0;
  let connecting = false;

  const schedule = () => {
    if (stopped || timer) return;
    attempt += 1;
    const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
    timer = setTimeout(() => {
      timer = undefined;
      void connect();
    }, delay);
    onState("RECONNECTING");
  };

  const connect = async () => {
    if (stopped || connecting || socket) return;
    connecting = true;
    onState(attempt === 0 ? "CONNECTING" : "RECONNECTING");
    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      // Auth refresh can fail transiently; retry without opening an anonymous socket.
    }
    connecting = false;
    if (stopped) return;
    if (!token) {
      schedule();
      return;
    }

    let nextSocket: WebSocket;
    try {
      nextSocket = new WebSocket(url);
    } catch {
      schedule();
      return;
    }
    socket = nextSocket;
    // An open transport without an auth acknowledgement is not a live stream.
    handshakeTimer = setTimeout(() => nextSocket.close(), 10_000);
    let authenticated = false;
    nextSocket.onopen = () => {
      if (stopped || socket !== nextSocket) return;
      nextSocket.send(JSON.stringify({ type: "authenticate", token }));
    };
    nextSocket.onmessage = (message) => {
      if (stopped || socket !== nextSocket) return;
      if (!authenticated) {
        try {
          if (JSON.parse(message.data).type !== "authenticated") return;
        } catch { return; }
        authenticated = true;
        clearTimeout(handshakeTimer);
        handshakeTimer = undefined;
        attempt = 0;
        onState("LIVE");
        return;
      }
      onMessage(message.data);
    };
    nextSocket.onerror = () => nextSocket.close();
    nextSocket.onclose = () => {
      if (socket !== nextSocket) return;
      clearTimeout(handshakeTimer);
      handshakeTimer = undefined;
      socket = undefined;
      if (stopped) return;
      schedule();
    };
  };

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    clearTimeout(handshakeTimer);
    handshakeTimer = undefined;
    const current = socket;
    socket = undefined;
    current?.close();
    onState("DISCONNECTED");
  };
}
