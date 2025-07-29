import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";

export function useWebSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;
    
    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "new_message":
              // Invalidate conversations to update last message
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
              
              // If we're viewing this conversation, invalidate its messages
              const conversationId = message.data.conversationId;
              queryClient.invalidateQueries({ 
                queryKey: ["/api/conversations", conversationId, "messages"] 
              });
              break;
              
            case "message_deleted":
              // Invalidate all message queries to reflect deletion
              queryClient.invalidateQueries({ 
                queryKey: ["/api/conversations", undefined, "messages"] 
              });
              break;
              
            case "call_initiated":
              // Handle incoming call
              console.log("Incoming call:", message.data);
              break;
              
            case "call_status_updated":
              // Handle call status updates
              console.log("Call status updated:", message.data);
              break;
              
            default:
              console.log("Unknown message type:", message.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.current.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        
        // Attempt to reconnect if not a normal closure and user is still authenticated
        if (event.code !== 1000 && user && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current) {
      ws.current.close(1000, "Component unmounting");
      ws.current = null;
    }
  };

  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected: ws.current?.readyState === WebSocket.OPEN,
    send: (data: any) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(data));
      }
    }
  };
}
