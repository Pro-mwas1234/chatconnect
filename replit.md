# Chat Application

## Overview

This is a full-stack real-time chat application built with React, Express, and PostgreSQL. It features instant messaging, file sharing, voice/video calls, group chats, and real-time notifications using WebSockets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for the user interface
- **Vite** as the build tool and development server
- **Tailwind CSS** with shadcn/ui components for styling
- **TanStack Query** for server state management and caching
- **Wouter** for client-side routing
- **React Hook Form** with Zod validation for form handling

### Backend Architecture
- **Express.js** server with TypeScript
- **Session-based authentication** using Passport.js with local strategy
- **WebSocket server** for real-time messaging and notifications
- **Multer** for file upload handling
- **RESTful API** endpoints for CRUD operations

### Database Architecture
- **PostgreSQL** as the primary database
- **Drizzle ORM** for database operations and schema management
- **Neon Database** as the hosting solution (via @neondatabase/serverless)
- **Connection pooling** for efficient database connections

## Key Components

### Authentication System
- Password hashing using Node.js crypto (scrypt)
- Session management with PostgreSQL session store
- Protected routes on both client and server
- User registration and login with validation

### Real-time Communication
- WebSocket connections for instant messaging
- Message broadcasting to conversation participants
- Online status tracking and presence indicators
- Call initiation and management through WebSocket events

### File Management
- File upload support for images, videos, audio, and documents
- 50MB file size limit with type validation
- Local file storage in uploads directory
- File metadata storage in database

### Chat Features
- Direct messaging between users
- Group chat creation and management
- Message replies and threading
- Message deletion functionality
- Unread message counting

## Data Flow

### Message Flow
1. User types message in chat interface
2. Client sends message via REST API to server
3. Server validates and stores message in database
4. Server broadcasts message to all conversation participants via WebSocket
5. Clients receive and display message in real-time
6. Query cache is invalidated to update conversation lists

### Authentication Flow
1. User submits login credentials
2. Server validates credentials against database
3. Session is created and stored in PostgreSQL
4. Client receives user data and updates auth state
5. Subsequent requests include session cookie for authentication

### File Upload Flow
1. User selects file through attachment menu
2. File is uploaded via multipart form data
3. Server validates file type and size
4. File is stored locally with unique filename
5. Message with file reference is created in database
6. File URL is broadcast to conversation participants

## External Dependencies

### UI Components
- **Radix UI** primitives for accessible component foundation
- **Lucide React** for consistent iconography
- **Class Variance Authority** for component variant management

### Development Tools
- **Replit integration** with runtime error overlay and cartographer
- **ESBuild** for production server bundling
- **PostCSS** with Autoprefixer for CSS processing

### Real-time Features
- **WebSocket (ws)** library for server-side WebSocket handling
- **Native WebSocket API** on client for real-time communication

## Deployment Strategy

### Development
- Vite dev server for client-side development
- Express server with hot reloading via tsx
- Database migrations managed through Drizzle Kit
- Environment variables for database connection

### Production
- Client built and served as static files from Express
- Server bundled with ESBuild for Node.js runtime
- PostgreSQL database with connection pooling
- Session store persisted in database
- File uploads stored locally (consider cloud storage for scaling)

### Environment Configuration
- `DATABASE_URL` required for PostgreSQL connection
- `SESSION_SECRET` required for session encryption
- Development vs production environment detection
- Replit-specific configurations for hosting platform