import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallModalProps {
  type: 'voice' | 'video';
  onEnd: () => void;
}

export default function CallModal({ type, onEnd }: CallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Simulate call connection after 3 seconds
    const timer = setTimeout(() => {
      setCallStatus('connected');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  useEffect(() => {
    // Initialize user media for video calls
    if (type === 'video' && callStatus === 'connected') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(error => {
          console.error('Error accessing camera:', error);
        });
    }
  }, [type, callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    // Stop all media tracks
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    onEnd();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // TODO: Implement actual mute functionality
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    // TODO: Implement actual video toggle functionality
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Call Header */}
      <div className="p-6 text-center text-white">
        {callStatus !== 'connected' ? (
          <>
            <Avatar className="w-32 h-32 mx-auto mb-4">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                SA
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-semibold mb-2">Sarah Anderson</h2>
            <p className="text-gray-300">
              {callStatus === 'calling' ? 'Calling...' : 'Connected'}
            </p>
          </>
        ) : (
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-medium">Connected</span>
            </div>
            <span className="text-lg font-mono">{formatDuration(callDuration)}</span>
          </div>
        )}
      </div>
      
      {/* Video Area (for video calls) */}
      {type === 'video' && callStatus === 'connected' && (
        <div className="flex-1 relative">
          {/* Remote video */}
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover bg-gray-900"
            autoPlay
            muted={false}
          />
          
          {/* Self video preview */}
          <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white overflow-hidden">
            <video
              ref={videoRef}
              className={cn(
                "w-full h-full object-cover",
                isVideoOff && "hidden"
              )}
              autoPlay
              muted
            />
            {isVideoOff && (
              <div className="w-full h-full flex items-center justify-center text-white bg-gray-800">
                <VideoOff className="w-6 h-6" />
              </div>
            )}
          </div>
          
          {/* Video call info overlay */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded-lg px-3 py-2 text-white">
            <p className="text-sm font-medium">Sarah Anderson</p>
            <p className="text-xs text-gray-300">{formatDuration(callDuration)}</p>
          </div>
        </div>
      )}
      
      {/* Voice call visualization */}
      {type === 'voice' && callStatus === 'connected' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Avatar className="w-48 h-48 mx-auto mb-8">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-4xl font-bold">
                SA
              </AvatarFallback>
            </Avatar>
            
            {/* Audio visualizer */}
            <div className="flex items-center justify-center space-x-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 bg-white rounded-full animate-pulse",
                    `h-${4 + (i % 3) * 2}`
                  )}
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    height: `${16 + (i % 3) * 8}px`
                  }}
                />
              ))}
            </div>
            
            <h2 className="text-3xl font-semibold text-white mb-2">Sarah Anderson</h2>
            <p className="text-xl text-gray-300">{formatDuration(callDuration)}</p>
          </div>
        </div>
      )}
      
      {/* Call Controls */}
      <div className="p-8">
        <div className="flex items-center justify-center space-x-6">
          {/* Mute button */}
          <Button
            onClick={toggleMute}
            className={cn(
              "w-16 h-16 rounded-full",
              isMuted 
                ? "bg-red-600 hover:bg-red-700" 
                : "bg-gray-600 hover:bg-gray-500"
            )}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </Button>
          
          {/* End call button */}
          <Button
            onClick={handleEndCall}
            className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </Button>
          
          {/* Video toggle button (only for video calls) */}
          {type === 'video' && (
            <Button
              onClick={toggleVideo}
              className={cn(
                "w-16 h-16 rounded-full",
                isVideoOff 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-gray-600 hover:bg-gray-500"
              )}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
