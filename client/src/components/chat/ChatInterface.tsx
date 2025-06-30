import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    content: "Hi there! I'm TheVideoPool customer support assistant. How can I help you today?",
    sender: 'assistant',
    timestamp: new Date(),
  },
];

export function ChatInterface() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus on the input field when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to use the customer support chat.",
        variant: "destructive",
      });
      return;
    }
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Send message to server
      const response = await apiRequest('POST', '/api/chat/message', {
        message: userMessage.content,
      });
      
      const data = await response.json();
      
      // Add assistant response to chat
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to get chat response:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting to our servers. Please try again later or contact info@thevideopool.com for immediate assistance.",
        sender: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection Error",
        description: "Failed to communicate with customer support. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send message on Enter (but not with Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="border border-muted w-full max-w-4xl mx-auto shadow-md">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-center text-xl flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            Authentication Required
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="mb-4">Please sign in to use the customer support chat.</p>
          <Button className="bg-gradient-to-r from-primary to-secondary" asChild>
            <a href="/login">Sign In</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-muted w-full max-w-4xl mx-auto shadow-md">
      <CardHeader className="bg-muted/30">
        <CardTitle className="text-xl">Customer Support</CardTitle>
      </CardHeader>
      
      <ScrollArea className="h-[500px] p-4">
        <div className="space-y-4 mb-4">
          {messages.map(message => (
            <div 
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`
                  flex gap-2 items-start max-w-[80%] 
                  ${message.sender === 'user' 
                    ? 'bg-primary/10 rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl text-foreground' 
                    : 'bg-secondary/10 rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl text-foreground'
                  }
                  p-3
                `}
              >
                <div className={`rounded-full p-1 flex items-center justify-center ${message.sender === 'user' ? 'bg-primary/20' : 'bg-secondary/20'}`}>
                  {message.sender === 'user' ? (
                    <User size={16} className="text-primary" />
                  ) : (
                    <Bot size={16} className="text-secondary" />
                  )}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary/10 rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl text-foreground p-3 flex items-center gap-2">
                <div className="rounded-full p-1 flex items-center justify-center bg-secondary/20">
                  <Bot size={16} className="text-secondary" />
                </div>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <CardFooter className="border-t p-3">
        <div className="flex gap-2 w-full">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className="min-h-12 flex-1 resize-none"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendMessage} 
            size="icon" 
            className="bg-gradient-to-r from-primary to-secondary"
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}