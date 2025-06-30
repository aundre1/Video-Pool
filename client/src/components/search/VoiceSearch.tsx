import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';

interface VoiceSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Modern voice search component 
 * Leveraging Web Speech API for TheVideoPool 2025 UX Enhancement
 */
const VoiceSearch = ({ 
  onSearch, 
  placeholder = "Listening...",
  className = ""
}: VoiceSearchProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition with browser compatibility
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US'; // Default to English
    
    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };
    
    recognitionRef.current.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;
      
      setTranscript(transcriptText);
      
      if (result.isFinal) {
        setIsProcessing(true);
        
        // Small delay to show the processing state
        setTimeout(() => {
          onSearch(transcriptText);
          setIsListening(false);
          setIsProcessing(false);
          setIsOpen(false);
        }, 500);
      }
    };
    
    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        toast({
          title: 'Microphone access denied',
          description: 'Please allow microphone access to use voice search.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Voice search error',
          description: `Error: ${event.error}. Please try again.`,
          variant: 'destructive'
        });
      }
    };
    
    recognitionRef.current.onend = () => {
      if (isListening && !isProcessing) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('Failed to restart recognition', e);
          setIsListening(false);
        }
      }
    };
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition', e);
        }
      }
    };
  }, [isListening, isProcessing, onSearch]);

  const toggleListening = () => {
    if (!speechSupported) {
      toast({
        title: 'Not supported',
        description: 'Voice search is not supported in your browser.',
        variant: 'destructive'
      });
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsOpen(false);
    } else {
      setIsOpen(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Failed to start recognition', e);
        toast({
          title: 'Voice search error',
          description: 'Failed to start voice recognition. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          onClick={toggleListening}
          size="icon" 
          variant={isListening ? "default" : "ghost"}
          className={`h-8 w-8 ${isListening ? 'bg-purple-600 hover:bg-purple-700' : 'text-gray-400 hover:text-white hover:bg-gray-800'} ${className}`}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isListening ? (
            <Mic className="h-4 w-4 animate-pulse" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
          <span className="sr-only">Voice Search</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 bg-gray-900/95 border border-gray-800 text-white backdrop-blur-md" 
        align="end"
      >
        <div className="space-y-2">
          <div className="font-medium text-sm flex items-center gap-2">
            {isListening ? (
              <Mic className="h-4 w-4 text-purple-500 animate-pulse" />
            ) : (
              <MicOff className="h-4 w-4 text-gray-400" />
            )}
            <span>{isListening ? 'Listening...' : 'Voice Search'}</span>
          </div>
          
          <div className="bg-black/30 rounded-lg p-3 min-h-[60px] flex items-center justify-center">
            {isListening ? (
              transcript ? (
                <p className="text-sm">{transcript}</p>
              ) : (
                <p className="text-sm text-gray-400">{placeholder}</p>
              )
            ) : (
              <p className="text-sm text-gray-400">
                Click the microphone icon to start voice search
              </p>
            )}
          </div>
          
          <div className="pt-2 text-xs text-gray-400">
            <p>Try saying: "Show me loop videos" or "Find dance club visuals"</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default VoiceSearch;