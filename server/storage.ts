import { users, conversations, messages, calls, conversationMembers, type User, type InsertUser, type Conversation, type InsertConversation, type Message, type InsertMessage, type Call, type InsertCall, type ConversationMember } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, or, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOnlineStatus(id: string, isOnline: boolean): Promise<void>;

  // Conversation methods
  getUserConversations(userId: string): Promise<(Conversation & { 
    members: (ConversationMember & { user: User })[], 
    lastMessage?: Message & { sender: User },
    unreadCount: number 
  })[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationMember(conversationId: string, userId: string): Promise<void>;
  getOrCreateDirectConversation(user1Id: string, user2Id: string): Promise<Conversation>;

  // Message methods
  getConversationMessages(conversationId: string, limit?: number, offset?: number): Promise<(Message & { sender: User, replyTo?: Message & { sender: User } })[]>;
  createMessage(message: InsertMessage): Promise<Message & { sender: User }>;
  deleteMessage(messageId: string, userId: string): Promise<boolean>;

  // Call methods
  createCall(call: InsertCall): Promise<Call>;
  updateCallStatus(callId: string, status: string): Promise<void>;
  endCall(callId: string): Promise<void>;

  // Search
  searchUsers(query: string, excludeUserId: string): Promise<User[]>;

  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ 
        isOnline,
        lastSeen: isOnline ? undefined : new Date()
      })
      .where(eq(users.id, id));
  }

  async getUserConversations(userId: string): Promise<(Conversation & { 
    members: (ConversationMember & { user: User })[], 
    lastMessage?: Message & { sender: User },
    unreadCount: number 
  })[]> {
    const userConversations = await db
      .select({
        conversation: conversations,
        member: conversationMembers,
        memberUser: users
      })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id))
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.userId, userId));

    const conversationIds = [...new Set(userConversations.map(uc => uc.conversation.id))];
    
    // Get all members for these conversations
    const allMembers = await db
      .select({
        member: conversationMembers,
        user: users
      })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(inArray(conversationMembers.conversationId, conversationIds));

    // Get last message for each conversation
    const lastMessages = await db
      .select({
        message: messages,
        sender: users
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          eq(messages.isDeleted, false)
        )
      )
      .orderBy(desc(messages.createdAt));

    // Group data by conversation
    const conversationMap = new Map();
    
    userConversations.forEach(uc => {
      if (!conversationMap.has(uc.conversation.id)) {
        conversationMap.set(uc.conversation.id, {
          ...uc.conversation,
          members: [],
          unreadCount: 0
        });
      }
    });

    allMembers.forEach(({ member, user }) => {
      const conv = conversationMap.get(member.conversationId);
      if (conv) {
        conv.members.push({ ...member, user });
      }
    });

    // Add last messages
    const lastMessageMap = new Map();
    lastMessages.forEach(({ message, sender }) => {
      if (!lastMessageMap.has(message.conversationId)) {
        lastMessageMap.set(message.conversationId, { ...message, sender });
      }
    });

    const result = Array.from(conversationMap.values()).map(conv => ({
      ...conv,
      lastMessage: lastMessageMap.get(conv.id)
    }));

    return result;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async addConversationMember(conversationId: string, userId: string): Promise<void> {
    await db
      .insert(conversationMembers)
      .values({ conversationId, userId })
      .onConflictDoNothing();
  }

  async getOrCreateDirectConversation(user1Id: string, user2Id: string): Promise<Conversation> {
    // Find existing direct conversation between these users
    const existingConversation = await db
      .select({ conversation: conversations })
      .from(conversations)
      .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
      .where(
        and(
          eq(conversations.isGroup, false),
          eq(conversationMembers.userId, user1Id)
        )
      )
      .intersect(
        db
          .select({ conversation: conversations })
          .from(conversations)
          .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
          .where(
            and(
              eq(conversations.isGroup, false),
              eq(conversationMembers.userId, user2Id)
            )
          )
      );

    if (existingConversation.length > 0) {
      return existingConversation[0].conversation;
    }

    // Create new direct conversation
    const newConversation = await this.createConversation({
      isGroup: false,
      createdBy: user1Id
    });

    // Add both users as members
    await this.addConversationMember(newConversation.id, user1Id);
    await this.addConversationMember(newConversation.id, user2Id);

    return newConversation;
  }

  async getConversationMessages(conversationId: string, limit = 50, offset = 0): Promise<(Message & { sender: User, replyTo?: Message & { sender: User } })[]> {
    const messageList = await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.isDeleted, false)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Get reply messages
    const replyIds = messageList
      .map(m => m.message.replyToId)
      .filter(Boolean) as string[];

    let replyMessages: (Message & { sender: User })[] = [];
    if (replyIds.length > 0) {
      replyMessages = await db
        .select({
          message: messages,
          sender: users,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(inArray(messages.id, replyIds));
    }

    const replyMap = new Map(replyMessages.map(r => [r.message.id, r]));

    return messageList.map(({ message, sender }) => ({
      ...message,
      sender,
      replyTo: message.replyToId ? replyMap.get(message.replyToId) : undefined
    })).reverse();
  }

  async createMessage(message: InsertMessage): Promise<Message & { sender: User }> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();

    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, message.senderId));

    return { ...newMessage, sender };
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(messages)
      .set({ isDeleted: true })
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.senderId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async createCall(call: InsertCall): Promise<Call> {
    const [newCall] = await db
      .insert(calls)
      .values(call)
      .returning();
    return newCall;
  }

  async updateCallStatus(callId: string, status: string): Promise<void> {
    await db
      .update(calls)
      .set({ status })
      .where(eq(calls.id, callId));
  }

  async endCall(callId: string): Promise<void> {
    await db
      .update(calls)
      .set({ 
        status: "ended",
        endedAt: new Date()
      })
      .where(eq(calls.id, callId));
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          or(
            sql`${users.username} ILIKE ${`%${query}%`}`,
            sql`${users.email} ILIKE ${`%${query}%`}`
          ),
          sql`${users.id} != ${excludeUserId}`
        )
      )
      .limit(20);
  }
}

export const storage = new DatabaseStorage();
