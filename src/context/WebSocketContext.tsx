import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";

export interface RealtimeMessage {
  type: string;
  aggregateId: string;
  sequenceNumber: number;
  payload: any;
  timestamp: number;
}

interface WebSocketContextType {
  isConnected: boolean;
  joinAuction: (auctionId: string) => void;
  leaveAuction: (auctionId: string) => void;
  subscribeToAuction: (auctionId: string, handler: (msg: RealtimeMessage) => void) => () => void;
  lastMessage: RealtimeMessage | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(msg: RealtimeMessage) => void>>>(new Map());
  const maxSequencesRef = useRef<Map<string, number>>(new Map());

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connection_ack" || data.type === "pong" || data.type === "auction_joined") {
            return;
          }

          const msg: RealtimeMessage = data;
          const { aggregateId, sequenceNumber } = msg;

          if (aggregateId && sequenceNumber) {
            const currentSeq = maxSequencesRef.current.get(aggregateId) || 0;
            // Discard stale or duplicate sequence numbers
            if (sequenceNumber <= currentSeq && msg.type === "bid_accepted") {
              console.warn(`[WS] Discarding stale event. Current seq: ${currentSeq}, received: ${sequenceNumber}`);
              return;
            }
            maxSequencesRef.current.set(aggregateId, sequenceNumber);
          }

          setLastMessage(msg);

          // Dispatch to auction-specific subscribers
          if (msg.aggregateId && handlersRef.current.has(msg.aggregateId)) {
            handlersRef.current.get(msg.aggregateId)!.forEach((fn) => fn(msg));
          }
        } catch (err) {
          // ignore malformed payloads
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const joinAuction = useCallback((auctionId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "auction_join", auctionId }));
    }
  }, []);

  const leaveAuction = useCallback((auctionId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "auction_leave", auctionId }));
    }
  }, []);

  const subscribeToAuction = useCallback((auctionId: string, handler: (msg: RealtimeMessage) => void) => {
    if (!handlersRef.current.has(auctionId)) {
      handlersRef.current.set(auctionId, new Set());
    }
    handlersRef.current.get(auctionId)!.add(handler);
    joinAuction(auctionId);

    return () => {
      const set = handlersRef.current.get(auctionId);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          handlersRef.current.delete(auctionId);
          leaveAuction(auctionId);
        }
      }
    };
  }, [joinAuction, leaveAuction]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        joinAuction,
        leaveAuction,
        subscribeToAuction,
        lastMessage,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useRealtime must be used within a WebSocketProvider");
  }
  return context;
};
