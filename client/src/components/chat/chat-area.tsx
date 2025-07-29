import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Video, 
  Info, 
  Paperclip, 
  Smile, 
  Mic, 
  Send,
  Reply,
  Trash2,
  Play,
  Download,
  MoreVertical
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import AttachmentMenu from "./attachment-menu";

interface ChatAreaProps {
  conversationId: string | null;
  onStartCall: (type: 'voice' | 'video') => void;
}

export default function ChatArea({ conversationId, onStartCall }: ChatAreaProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversation } = useQuery<any>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, messageData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessage("");
      setReplyingTo(null);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (uploadResult, file) => {
      const messageType = file.type.startsWith('image/') ? 'image' : 
                         file.type.startsWith('video/') ? 'video' :
                         file.type.startsWith('audio/') ? 'audio' : 'file';
      
      sendMessageMutation.mutate({
        type: messageType,
        fileUrl: uploadResult.url,
        fileName: uploadResult.filename,
        fileSize: uploadResult.size,
        content: `Shared ${messageType}: ${uploadResult.filename}`,
        replyToId: replyingTo?.id,
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    sendMessageMutation.mutate({
      content: message,
      type: "text",
      replyToId: replyingTo?.id,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      uploadFileMutation.mutate(file);
    });
    setShowAttachmentMenu(false);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
        uploadFileMutation.mutate(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const getConversationName = () => {
    if (!conversation) return "";
    if (conversation.isGroup) return conversation.name || "Group Chat";
    
    // For direct chats, show the other user's name
    const otherMember = conversation.members?.find((m: any) => m.user.id !== user?.id);
    return otherMember?.user.username || "Unknown User";
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Paperclip className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
          <p>Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {getConversationName().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{getConversationName()}</h3>
            <p className="text-sm text-green-600">Online</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onStartCall('voice')}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onStartCall('video')}
          >
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="bg-blue-50 p-3 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Reply className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Replying to {replyingTo.sender.username}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              ×
            </Button>
          </div>
          <p className="text-sm text-blue-700 mt-1 truncate">
            {replyingTo.content}
          </p>
        </div>
      )}
      
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 bg-gray-50">
        {messagesLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-start space-x-3",
                  msg.senderId === user?.id ? "flex-row-reverse space-x-reverse" : ""
                )}
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={cn(
                    msg.senderId === user?.id 
                      ? "bg-primary text-white" 
                      : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                  )}>
                    {msg.sender.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className={cn(
                  "flex-1 flex flex-col",
                  msg.senderId === user?.id ? "items-end" : "items-start"
                )}>
                  {/* Reply context */}
                  {msg.replyTo && (
                    <div className="bg-gray-200 rounded-lg p-2 mb-2 max-w-md border-l-4 border-primary">
                      <p className="text-xs text-gray-600 font-medium">
                        {msg.replyTo.sender.username}
                      </p>
                      <p className="text-sm text-gray-700 truncate">
                        {msg.replyTo.content}
                      </p>
                    </div>
                  )}
                  
                  {/* Message content */}
                  <div className={cn(
                    "rounded-2xl p-3 shadow-sm max-w-md relative group",
                    msg.senderId === user?.id
                      ? "bg-primary text-white rounded-tr-md"
                      : "bg-white text-gray-900 rounded-tl-md"
                  )}>
                    {/* Message actions menu */}
                    {msg.senderId === user?.id && (
                      <div className="absolute top-0 right-0 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 bg-white text-gray-700 hover:bg-gray-100"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setReplyingTo(msg)}>
                              <Reply className="w-4 h-4 mr-2" />
                              Reply
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteMessageMutation.mutate(msg.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {/* Render based on message type */}
                    {msg.type === 'text' && (
                      <p>{msg.content}</p>
                    )}
                    
                    {msg.type === 'image' && (
                      <div>
                        <img 
                          src={msg.fileUrl} 
                          alt={msg.fileName}
                          className="rounded-lg max-w-full h-auto mb-2"
                        />
                        {msg.content && <p>{msg.content}</p>}
                      </div>
                    )}
                    
                    {msg.type === 'audio' && (
                      <div className="flex items-center space-x-3">
                        <Button size="sm" variant="ghost" className="w-8 h-8 p-0">
                          <Play className="w-4 h-4" />
                        </Button>
                        <div className="flex-1 h-6 flex items-center space-x-1">
                          {/* Audio waveform visualization */}
                          {[8, 16, 12, 20, 8, 14, 10].map((height, i) => (
                            <div
                              key={i}
                              className="w-1 bg-current rounded-full opacity-60"
                              style={{ height: `${height}px` }}
                            />
                          ))}
                        </div>
                        <span className="text-xs opacity-80">0:15</span>
                      </div>
                    )}
                    
                    {(msg.type === 'video' || msg.type === 'file') && (
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Download className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{msg.fileName}</p>
                          <p className="text-xs opacity-80">
                            {Math.round(msg.fileSize / 1024)} KB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Message timestamp and status */}
                  <div className="flex items-center space-x-1 mt-1">
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                    {msg.senderId === user?.id && (
                      <div className="text-primary">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M20 6L9 17L4 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 6L8 14L6 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>
      
      {/* Message Input */}
      <div className="bg-white p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-12 bg-gray-100 border-0 focus:bg-white rounded-full"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </div>
          
          {message.trim() ? (
            <Button 
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending}
              className="rounded-full w-10 h-10 p-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onMouseDown={startVoiceRecording}
              onMouseUp={stopVoiceRecording}
              onMouseLeave={stopVoiceRecording}
              className={cn(
                "rounded-full w-10 h-10 p-0",
                isRecording && "bg-red-500 hover:bg-red-600"
              )}
            >
              <Mic className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {/* Attachment Menu */}
        <AttachmentMenu
          show={showAttachmentMenu}
          onFileSelect={handleFileUpload}
          onClose={() => setShowAttachmentMenu(false)}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
    </div>
  );
}
