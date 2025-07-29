import { useState } from "react";
import ChatSidebar from "@/components/chat/chat-sidebar";
import ChatArea from "@/components/chat/chat-area";
import CallModal from "@/components/chat/call-modal";
import NewGroupModal from "@/components/chat/new-group-modal";
import { useWebSocket } from "@/hooks/use-websocket";

export default function HomePage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');

  // Initialize WebSocket connection
  useWebSocket();

  const handleStartCall = (type: 'voice' | 'video') => {
    setCallType(type);
    setShowCallModal(true);
  };

  const handleEndCall = () => {
    setShowCallModal(false);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      <ChatSidebar
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onNewGroup={() => setShowNewGroupModal(true)}
      />
      
      <ChatArea
        conversationId={selectedConversationId}
        onStartCall={handleStartCall}
      />

      {showCallModal && (
        <CallModal
          type={callType}
          onEnd={handleEndCall}
        />
      )}

      {showNewGroupModal && (
        <NewGroupModal
          onClose={() => setShowNewGroupModal(false)}
          onCreated={(conversationId) => {
            setSelectedConversationId(conversationId);
            setShowNewGroupModal(false);
          }}
        />
      )}
    </div>
  );
}
