import { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface VideoPreviewProps {
  videoId: number;
  thumbnailUrl: string;
  title: string;
  isPremium: boolean;
  showQuickPreview?: boolean;
  onDownload?: () => void;
}

export default function InstantPreview({
  videoId,
  thumbnailUrl,
  title,
  isPremium,
  showQuickPreview = true,
  onDownload,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState<string | null>(null);
  const [fullPreviewUrl, setFullPreviewUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'quick' | 'full'>('quick');
  const [qualityLevel, setQualityLevel] = useState<string>('auto');
  const { user } = useAuth();
  
  // Generate quick preview URL (2-5 second low-res preview)
  useEffect(() => {
    if (showQuickPreview) {
      // This would normally fetch a short, low-res preview
      // For demo, we'll use the same preview URL but with a time limit parameter
      const getQuickPreview = async () => {
        try {
          setIsLoading(true);
          
          // Fetch quick preview URL - this is a low-resolution, 5-second clip
          const response = await apiRequest('GET', `/api/videos/${videoId}/preview?type=quick`);
          const data = await response.json();
          setQuickPreviewUrl(data.previewUrl);
          
          setLoadProgress(100);
          setIsLoading(false);
        } catch (error) {
          console.error('Error loading quick preview:', error);
          setIsLoading(false);
        }
      };
      
      getQuickPreview();
    }
  }, [videoId, showQuickPreview]);
  
  // Load full preview URL (30 seconds or full video for members)
  const loadFullPreview = async () => {
    try {
      setIsLoading(true);
      setLoadProgress(0);
      
      // Simulate progressive loading
      const loadingInterval = setInterval(() => {
        setLoadProgress(prev => {
          const newProgress = prev + Math.random() * 15;
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 300);
      
      // Fetch full preview URL with adaptive streaming options
      const response = await apiRequest('GET', 
        `/api/videos/${videoId}/preview?type=full&quality=${qualityLevel}`);
      const data = await response.json();
      setFullPreviewUrl(data.previewUrl);
      
      clearInterval(loadingInterval);
      setLoadProgress(100);
      setIsLoading(false);
      setPreviewMode('full');
      
      // Auto play when full preview is loaded
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error loading full preview:', error);
      setIsLoading(false);
    }
  };
  
  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handleDurationChange = () => {
      setDuration(video.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      video.currentTime = 0;
    };
    
    const handleLoadStart = () => {
      setIsLoading(true);
    };
    
    const handleCanPlay = () => {
      setIsLoading(false);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);
  
  // Update video properties when they change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.volume = volume;
    video.muted = isMuted;
    
    if (isPlaying) {
      video.play().catch(error => {
        console.error('Error playing video:', error);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, volume, isMuted]);
  
  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  const togglePlay = () => {
    if (previewMode === 'quick' && !isPlaying) {
      // When first clicking play on quick preview, load full preview instead
      loadFullPreview();
    } else {
      setIsPlaying(!isPlaying);
    }
  };
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };
  
  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };
  
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (isFullscreen) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    }
  };
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Determine current preview source
  const currentPreviewUrl = previewMode === 'quick' ? quickPreviewUrl : fullPreviewUrl;
  
  return (
    <Card className="overflow-hidden bg-black border-dark-border rounded-lg">
      <div ref={containerRef} className="relative group">
        {/* Video or Thumbnail */}
        {currentPreviewUrl ? (
          <video
            ref={videoRef}
            className="w-full aspect-video object-contain bg-black"
            poster={thumbnailUrl}
            preload="metadata"
            playsInline
          >
            <source src={currentPreviewUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="relative">
            <img 
              src={thumbnailUrl} 
              alt={title} 
              className="w-full aspect-video object-cover bg-black"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              {isLoading ? (
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-middle"></div>
                  <div className="mt-2 text-sm">Loading preview ({Math.round(loadProgress)}%)</div>
                  <Progress value={loadProgress} className="w-32 h-1 mt-2" />
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-16 w-16 rounded-full border-2 border-white hover:bg-primary/20 hover:text-white"
                  onClick={togglePlay}
                >
                  <Play className="h-8 w-8" />
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Video Controls - visible on hover or when video is playing */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity duration-300 ${(isPlaying || isFullscreen) ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <div className="flex flex-col gap-2">
            {/* Progress bar */}
            {previewMode === 'full' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="flex-grow h-1"
                />
                <span className="text-xs text-white">{formatTime(duration)}</span>
              </div>
            )}
            
            {/* Control buttons */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={togglePlay}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <div className="w-20 hidden sm:block">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="h-1"
                  />
                </div>
                
                {previewMode === 'quick' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white hover:bg-white/20"
                    onClick={loadFullPreview}
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Full Preview
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Quality selector for full preview */}
                {previewMode === 'full' && (
                  <select
                    value={qualityLevel}
                    onChange={(e) => setQualityLevel(e.target.value)}
                    className="text-xs bg-transparent border border-white/20 rounded px-1 py-0.5 text-white"
                  >
                    <option value="auto">Auto</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                )}
                
                {/* Download button (if user can download) */}
                {user && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handleDownload}
                    disabled={isPremium && (!user.membershipId || user.downloadsRemaining === 0)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Premium indicator */}
        {isPremium && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-primary to-secondary text-white text-xs px-2 py-1 rounded-full">
            Premium
          </div>
        )}
      </div>
      
      <CardContent className="py-3">
        <h3 className="font-medium truncate">{title}</h3>
      </CardContent>
    </Card>
  );
}