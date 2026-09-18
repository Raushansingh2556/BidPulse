import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import EventEmitter from "events";

export interface WebSocketClient extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  joinedAuctions?: Set<string>;
}

export class RealtimeBroker extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocketClient> = new Set();
  private isRedisConnected = false;

  constructor() {
    super();
  }

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocketClient) => {
      ws.isAlive = true;
      ws.joinedAuctions = new Set();
      this.clients.add(ws);

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (data: string) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(ws, msg);
        } catch (err) {
          // ignore malformed message
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      // Send initial welcome message
      ws.send(JSON.stringify({
        type: "connection_ack",
        serverTime: new Date().toISOString(),
        serverTimeMs: Date.now(),
      }));
    });

    // Heartbeat ping interval
    const interval = setInterval(() => {
      if (!this.wss) return;
      this.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on("close", () => {
      clearInterval(interval);
    });

    console.log("[WS] WebSocket Server attached to HTTP server on path /ws");
  }

  private handleClientMessage(ws: WebSocketClient, msg: any): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "auction_join":
        if (msg.auctionId) {
          ws.joinedAuctions?.add(msg.auctionId);
          ws.send(JSON.stringify({
            type: "auction_joined",
            auctionId: msg.auctionId,
            status: "ok",
          }));
        }
        break;

      case "auction_leave":
        if (msg.auctionId) {
          ws.joinedAuctions?.delete(msg.auctionId);
        }
        break;

      case "auth":
        if (msg.userId) {
          ws.userId = msg.userId;
        }
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong", serverTimeMs: Date.now() }));
        break;
    }
  }

  /**
   * Broadcasts an authoritative event from the Transactional Outbox to connected clients
   */
  publishEvent(eventType: string, aggregateId: string, payload: any, sequenceNumber: number): void {
    const message = JSON.stringify({
      type: eventType.toLowerCase(),
      aggregateId,
      sequenceNumber,
      payload,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Send if client joined this auction or if it's a broadcast
        if (
          !client.joinedAuctions ||
          client.joinedAuctions.size === 0 ||
          client.joinedAuctions.has(aggregateId)
        ) {
          client.send(message);
          sentCount++;
        }
      }
    });
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const realtime = new RealtimeBroker();
