import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertConversationSchema, insertMessageSchema, insertCallSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// File upload configuration
const uploadDir = path.resolve(import.meta.dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio files, and documents
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mp3|wav|m4a|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // WebSocket connections map
  const connections = new Map<string, WebSocket>();

  // Middleware to ensure authentication for API routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Get user conversations
  app.get("/api/conversations", requireAuth, async (req: any, res) => {
    try {
      const conversations = await storage.getUserConversations(req.user.id);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", requireAuth, async (req: any, res) => {
    try {
      const data = insertConversationSchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
      const conversation = await storage.createConversation(data);
      
      // Add creator as member
      await storage.addConversationMember(conversation.id, req.user.id);
      
      // Add other members if specified
      if (req.body.memberIds && Array.isArray(req.body.memberIds)) {
        for (const memberId of req.body.memberIds) {
          await storage.addConversationMember(conversation.id, memberId);
        }
      }
      
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ error: "Failed to create conversation" });
    }
  });

  // Start direct conversation
  app.post("/api/conversations/direct", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const conversation = await storage.getOrCreateDirectConversation(req.user.id, userId);
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create direct conversation" });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;
      
      const messages = await storage.getConversationMessages(
        id, 
        limit ? parseInt(limit) : 50,
        offset ? parseInt(offset) : 0
      );
      
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send message
  app.post("/api/conversations/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = insertMessageSchema.parse({
        ...req.body,
        conversationId: id,
        senderId: req.user.id
      });
      
      const message = await storage.createMessage(data);
      
      // Broadcast to WebSocket connections
      const wsMessage = JSON.stringify({
        type: "new_message",
        data: message
      });
      
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(wsMessage);
        }
      });
      
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Failed to send message" });
    }
  });

  // Delete message
  app.delete("/api/messages/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteMessage(id, req.user.id);
      
      if (!success) {
        return res.status(404).json({ error: "Message not found or unauthorized" });
      }
      
      // Broadcast message deletion
      const wsMessage = JSON.stringify({
        type: "message_deleted",
        data: { messageId: id }
      });
      
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(wsMessage);
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // File upload
  app.post("/api/upload", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Search users
  app.get("/api/users/search", requireAuth, async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(q, req.user.id);
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline
      })));
    } catch (error) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Call management
  app.post("/api/calls", requireAuth, async (req: any, res) => {
    try {
      const data = insertCallSchema.parse({
        ...req.body,
        callerId: req.user.id
      });
      
      const call = await storage.createCall(data);
      
      // Broadcast call initiation
      const wsMessage = JSON.stringify({
        type: "call_initiated",
        data: call
      });
      
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(wsMessage);
        }
      });
      
      res.status(201).json(call);
    } catch (error) {
      res.status(400).json({ error: "Failed to initiate call" });
    }
  });

  app.patch("/api/calls/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (status === "ended") {
        await storage.endCall(id);
      } else {
        await storage.updateCallStatus(id, status);
      }
      
      // Broadcast call status update
      const wsMessage = JSON.stringify({
        type: "call_status_updated",
        data: { callId: id, status }
      });
      
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(wsMessage);
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update call" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const userId = req.url?.split('userId=')[1];
    
    if (userId) {
      connections.set(userId, ws);
      // Update user online status
      storage.updateUserOnlineStatus(userId, true);
    }

    ws.on('close', () => {
      if (userId) {
        connections.delete(userId);
        // Update user offline status
        storage.updateUserOnlineStatus(userId, false);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return httpServer;
}
