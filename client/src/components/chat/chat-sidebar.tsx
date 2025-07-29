import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Plus, 
  Users, 
  Settings, 
  LogOut, 
  Mic,
  CheckCheck,
  Circle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewGroup: () => void;
}

export default function ChatSidebar({ 
  selectedConversationId, 
  onSelectConversation, 
  onNewGroup 
}: ChatSidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: userSearchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/users/search", searchQuery],
    enabled: showUserSearch && searchQuery.length >= 2,
  });

  const handleStartDirectChat = async (userId: string) => {
    try {
      const response = await fetch("/api/conversations/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      
      if (response.ok) {
        const conversation = await response.json();
        onSelectConversation(conversation.id);
        setShowUserSearch(false);
        setSearchQuery("");
      }
    } catch (error) {
      console.error("Failed to start direct chat:", error);
    }
  };

  const getConversationName = (conversation: any) => {
    if (conversation.isGroup) {
      return conversation.name || "Group Chat";
    }
    
    // For direct chats, show the other user's name
    const otherMember = conversation.members?.find((m: any) => m.user.id !== user?.id);
    return otherMember?.user.username || "Unknown User";
  };

  const getConversationAvatar = (conversation: any) => {
    if (conversation.isGroup) {
      return conversation.name?.charAt(0)?.toUpperCase() || "G";
    }
    
    const otherMember = conversation.members?.find((m: any) => m.user.id !== user?.id);
    return otherMember?.user.username?.charAt(0)?.toUpperCase() || "U";
  };

  const getLastMessagePreview = (conversation: any) => {
    const lastMessage = conversation.lastMessage;
    if (!lastMessage) return "No messages yet";
    
    switch (lastMessage.type) {
      case "image":
        return "📷 Photo";
      case "video":
        return "🎥 Video";
      case "audio":
        return "🎤 Voice message";
      case "file":
        return "📎 File";
      default:
        return lastMessage.content || "";
    }
  };

  const filteredConversations = conversations.filter((conv: any) => 
    getConversationName(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10 bg-primary">
              <AvatarFallback className="bg-primary text-white font-semibold">
                {user?.username?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-gray-900">{user?.username}</h2>
              <p className="text-sm text-green-600 flex items-center">
                <Circle className="w-2 h-2 fill-current mr-1" />
                Online
              </p>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search conversations or users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowUserSearch(e.target.value.length >= 2);
            }}
            className="pl-10 bg-gray-100 border-0 focus:bg-white"
          />
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex space-x-2">
          <Button 
            className="flex-1" 
            onClick={() => setShowUserSearch(!showUserSearch)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onNewGroup}
          >
            <Users className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </div>
      </div>
      
      {/* User search results */}
      {showUserSearch && (
        <div className="border-b border-gray-200">
          <div className="p-3 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-2">People</h3>
            <ScrollArea className="h-32">
              {userSearchResults.length > 0 ? (
                <div className="space-y-1">
                  {userSearchResults.map((searchUser: any) => (
                    <div
                      key={searchUser.id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                      onClick={() => handleStartDirectChat(searchUser.id)}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {searchUser.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {searchUser.username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {searchUser.email}
                        </p>
                      </div>
                      {searchUser.isOnline && (
                        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No users found
                </p>
              ) : null}
            </ScrollArea>
          </div>
        </div>
      )}
      
      {/* Chat List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex space-x-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No conversations yet</p>
            <p className="text-sm">Start a new chat to begin messaging</p>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conversation: any) => (
              <div
                key={conversation.id}
                className={cn(
                  "p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors",
                  selectedConversationId === conversation.id && "bg-blue-50 border-r-2 border-primary"
                )}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className={cn(
                        conversation.isGroup 
                          ? "bg-gradient-to-br from-green-500 to-teal-600" 
                          : "bg-gradient-to-br from-blue-500 to-purple-600",
                        "text-white font-semibold"
                      )}>
                        {conversation.isGroup ? (
                          <Users className="w-5 h-5" />
                        ) : (
                          getConversationAvatar(conversation)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {!conversation.isGroup && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {getConversationName(conversation)}
                      </h3>
                      {conversation.lastMessage && (
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage?.type === 'audio' && (
                          <Mic className="w-3 h-3 inline mr-1" />
                        )}
                        {getLastMessagePreview(conversation)}
                      </p>
                      <div className="flex items-center space-x-1">
                        {conversation.unreadCount > 0 && (
                          <Badge className="bg-primary text-white text-xs px-2 py-1">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                        {conversation.lastMessage?.senderId === user?.id && (
                          <CheckCheck className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
