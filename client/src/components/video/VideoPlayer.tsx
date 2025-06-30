import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { Button } from '@/components/ui/button';
import {
  PlayCircle,
  PauseCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Download,
  Heart,
  Share2,
  Plus
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVideoAuth } from '@/hooks/use-video-auth';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

interface VideoPlayerProps {
  videoId: number;
  videoUrl: string;
  title: string;
  isPreview?: boolean;
  isPremium?: boolean;
  addToLibraryEnabled?: boolean;
  onAddToLibrary?: () => void;
}

export default function VideoPlayer({
  videoId,
  videoUrl,
  title,
  isPreview = false,
  isPremium = false,
  addToLibraryEnabled = false,
  onAddToLibrary
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loop, setLoop] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  
  const playerRef = useRef<ReactPlayer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Handle auto-hiding controls during playback
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      
      if (playing && hasStartedPlaying) {
        controlsTimeout.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [playing, hasStartedPlaying]);

  // Reset controls visibility when paused
  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    }
  }, [playing]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!fullscreen && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error with fullscreen:', error);
    }
  };

  const handlePlayPause = () => {
    setPlaying(!playing);
    if (!hasStartedPlaying && !playing) {
      setHasStartedPlaying(true);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    setVolume(values[0]);
    setMuted(values[0] === 0);
  };

  const handleToggleMute = () => {
    setMuted(!muted);
  };

  const handleProgress = (state: { played: number; loaded: number; playedSeconds: number }) => {
    // Only update state if not currently seeking
    setPlayed(state.played);
    setLoaded(state.loaded);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSeek = (values: number[]) => {
    setPlayed(values[0]);
    if (playerRef.current) {
      playerRef.current.seekTo(values[0]);
    }
  };

  const handleToggleLoop = () => {
    setLoop(!loop);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const { downloadVideo } = useVideoAuth();
  
  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadVideo(videoId, title);
    } finally {
      setDownloading(false);
    }
  };

  const handleAddToLibrary = () => {
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to add videos to your library.',
        variant: 'destructive'
      });
      return;
    }

    if (onAddToLibrary) {
      onAddToLibrary();
    }
  };

  // Theme-consistent custom player gradient
  const customControlsGradient = `
    linear-gradient(
      to top,
      rgba(0, 0, 0, 0.7) 0%,
      rgba(0, 0, 0, 0.5) 40%,
      rgba(0, 0, 0, 0) 100%
    )
  `;

  return (
    <div 
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden bg-black aspect-video"
      style={{ maxHeight: fullscreen ? '100vh' : 'auto' }}
    >
      <ReactPlayer
        ref={playerRef}
        url={videoUrl}
        playing={playing}
        loop={loop}
        volume={volume}
        muted={muted}
        width="100%"
        height="100%"
        progressInterval={500}
        onProgress={handleProgress}
        onDuration={handleDuration}
        onEnded={() => setPlaying(false)}
        config={{
          file: {
            attributes: {
              controlsList: 'nodownload' // Prevent default browser download button
            }
          }
        }}
      />
      
      {/* Custom controls overlay - shown when showControls is true */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: showControls ? 'auto' : 'none' }}
      >
        {/* Gradient overlay at bottom for better text visibility */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: customControlsGradient }}
        />
        
        {/* Title bar at top */}
        {title && (
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent">
            <h3 className="text-white font-medium">{title}</h3>
            {isPreview && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-primary/80 text-white rounded-full">
                Preview
              </span>
            )}
          </div>
        )}
        
        {/* Main central play/pause button */}
        <button
          onClick={handlePlayPause}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/90 hover:text-white transition-colors"
        >
          {playing ? (
            <PauseCircle className="w-16 h-16 drop-shadow-lg" />
          ) : (
            <PlayCircle className="w-16 h-16 drop-shadow-lg" />
          )}
        </button>
        
        {/* Bottom controls bar */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {/* Progress bar */}
          <div className="mb-2 px-1">
            <Slider
              defaultValue={[0]}
              value={[played]}
              max={1}
              step={0.001}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="w-full mt-1 flex justify-between">
              <span className="text-xs text-white/80">{formatTime(duration * played)}</span>
              <span className="text-xs text-white/80">{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-3">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="text-white/90 hover:text-white"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <PauseCircle className="w-6 h-6" />
                ) : (
                  <PlayCircle className="w-6 h-6" />
                )}
              </button>
              
              {/* Volume control */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleToggleMute}
                  className="text-white/90 hover:text-white"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="w-6 h-6" />
                  ) : (
                    <Volume2 className="w-6 h-6" />
                  )}
                </button>
                <div className="w-20 hidden sm:block">
                  <Slider
                    defaultValue={[0.7]}
                    value={[muted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                  />
                </div>
              </div>
              
              {/* Loop button */}
              <button
                onClick={handleToggleLoop}
                className={`${loop ? 'text-primary' : 'text-white/90'} hover:text-primary`}
                aria-label={loop ? 'Disable loop' : 'Enable loop'}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex space-x-3">
              {/* Add to library button */}
              {addToLibraryEnabled && (
                <button
                  onClick={handleAddToLibrary}
                  className="text-white/90 hover:text-primary"
                  aria-label="Add to library"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              
              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={downloading || isPreview}
                className={`${isPreview ? 'text-white/40 cursor-not-allowed' : 'text-white/90 hover:text-primary'}`}
                aria-label="Download video"
              >
                <Download className="w-5 h-5" />
              </button>
              
              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                className="text-white/90 hover:text-white"
                aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {fullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Premium content overlay */}
      {isPremium && !isAuthenticated && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-6">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-6 rounded-lg backdrop-blur-sm">
            <h3 className="text-xl font-bold mb-2 text-white">Premium Content</h3>
            <p className="text-white/80 mb-4">
              This video is available to premium members only.
              Join now to access our entire library of professional video content.
            </p>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              Become a Member
            </Button>
          </div>
        </div>
      )}
      
      {/* Preview limitation overlay */}
      {isPreview && hasStartedPlaying && played >= 0.25 && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 text-center">
          <p className="text-white text-sm">
            This is a preview. <a href="#" className="text-primary hover:underline">Upgrade to download</a> full videos.
          </p>
        </div>
      )}
    </div>
  );
}