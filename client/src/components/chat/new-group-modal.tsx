import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Users, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface NewGroupModalProps {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export default function NewGroupModal({ onClose, onCreated }: NewGroupModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length >= 2,
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: any) => {
      const response = await apiRequest("POST", "/api/conversations", groupData);
      return response.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      onCreated(conversation.id);
    },
  });

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;

    createGroupMutation.mutate({
      name: groupName,
      description,
      isGroup: true,
      memberIds: selectedMembers,
    });
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectedUsers = searchResults.filter((u: any) => selectedMembers.includes(u.id));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Create New Group</span>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name */}
          <div>
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="group-description">Description (Optional)</Label>
            <Textarea
              id="group-description"
              placeholder="Describe your group"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 resize-none"
            />
          </div>

          {/* Member Search */}
          <div>
            <Label>Add Members</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Selected Members */}
          {selectedUsers.length > 0 && (
            <div>
              <Label className="text-sm text-gray-600">Selected Members ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedUsers.map((selectedUser: any) => (
                  <div
                    key={selectedUser.id}
                    className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{selectedUser.username}</span>
                    <button
                      onClick={() => toggleMember(selectedUser.id)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div>
              <Label className="text-sm text-gray-600">Available Users</Label>
              <ScrollArea className="h-32 mt-2 border rounded-lg">
                {searchResults.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {searchResults
                      .filter((searchUser: any) => searchUser.id !== user?.id)
                      .map((searchUser: any) => (
                        <div
                          key={searchUser.id}
                          className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                          onClick={() => toggleMember(searchUser.id)}
                        >
                          <Checkbox
                            checked={selectedMembers.includes(searchUser.id)}
                            onChange={() => toggleMember(searchUser.id)}
                          />
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
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No users found
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0 || createGroupMutation.isPending}
              className="flex-1"
            >
              {createGroupMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
