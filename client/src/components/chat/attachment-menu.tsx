import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Image, Video, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentMenuProps {
  show: boolean;
  onFileSelect: (files: FileList | null) => void;
  onClose: () => void;
}

export default function AttachmentMenu({ show, onFileSelect, onClose }: AttachmentMenuProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  if (!show) return null;

  const handleImageClick = () => {
    imageInputRef.current?.click();
    onClose();
  };

  const handleVideoClick = () => {
    videoInputRef.current?.click();
    onClose();
  };

  const handleDocumentClick = () => {
    documentInputRef.current?.click();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-transparent z-10"
        onClick={onClose}
      />
      
      {/* Menu */}
      <Card className={cn(
        "absolute bottom-16 left-4 p-4 z-20 shadow-2xl transition-all duration-200",
        show ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}>
        <div className="grid grid-cols-2 gap-3 w-64">
          <Button
            variant="ghost"
            className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-purple-50"
            onClick={handleImageClick}
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Image className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium">Photo</span>
          </Button>

          <Button
            variant="ghost"
            className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-red-50"
            onClick={handleVideoClick}
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Video className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-sm font-medium">Video</span>
          </Button>

          <Button
            variant="ghost"
            className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-blue-50"
            onClick={handleDocumentClick}
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium">Document</span>
          </Button>

          <Button
            variant="ghost"
            className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-green-50"
            disabled
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium">Contact</span>
          </Button>
        </div>
      </Card>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files)}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.rtf"
        multiple
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files)}
      />
    </>
  );
}
