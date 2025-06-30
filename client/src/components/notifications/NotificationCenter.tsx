import { useState, useEffect, useRef } from "react";
import { Bell, Calendar, X, Check, ChevronRight, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  data?: any;
  timestamp: string;
  read: boolean;
}

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  type: 'new-video' | 'featured' | 'event' | 'promotion';
  description?: string;
  imageUrl?: string;
  link?: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");
  const [isConnected, setIsConnected] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  
  // Connect to WebSocket for real-time notifications
  useEffect(() => {
    if (!user) return;
    
    // Cleanup previous connection
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Create device ID if not exists
    const deviceId = localStorage.getItem('deviceId') || 
      `device_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
    
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${user.id}&deviceId=${deviceId}`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log("WebSocket connection established");
      setIsConnected(true);
      
      // Request calendar events
      socket.send(JSON.stringify({
        type: 'get-calendar',
        payload: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSocketMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user]);
  
  // Load initial notifications from API
  useEffect(() => {
    if (!user) return;
    
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications');
        if (!response.ok) throw new Error('Failed to fetch notifications');
        const data = await response.json();
        
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    fetchNotifications();
  }, [user]);
  
  const handleSocketMessage = (data: any) => {
    switch (data.type) {
      case 'welcome':
        console.log("WebSocket welcome:", data.message);
        break;
        
      case 'notification':
        // Add new notification to the list
        setNotifications(prev => [data.notification, ...prev]);
        setUnreadCount(count => count + 1);
        
        // Show toast for the new notification
        toast({
          title: data.notification.title,
          description: data.notification.message,
        });
        break;
        
      case 'pending-notifications':
        // Update unread count
        setUnreadCount(data.count);
        break;
        
      case 'calendar-events':
        // Update calendar events
        setEvents(data.events);
        break;
        
      default:
        console.log("Unknown WebSocket message type:", data.type);
    }
  };
  
  const markAsRead = async (notificationId?: number) => {
    if (!user) return;
    
    try {
      // If notificationId is provided, mark specific notification as read
      // Otherwise, mark all as read
      const notificationIds = notificationId ? [notificationId] : [];
      
      // Send to WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'mark-read',
          payload: { notificationIds }
        }));
      }
      
      // Update UI immediately
      setNotifications(prev => 
        prev.map(n => 
          (!notificationId || n.id === notificationId) 
            ? { ...n, read: true } 
            : n
        )
      );
      
      // Update unread count
      const newUnreadCount = notificationId 
        ? unreadCount - 1 
        : 0;
      setUnreadCount(Math.max(0, newUnreadCount));
      
      // Also update via API
      await apiRequest('POST', '/api/notifications/mark-read', { notificationIds });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };
  
  const subscribeToCategory = async (categoryId: number) => {
    if (!user || !socketRef.current) return;
    
    try {
      socketRef.current.send(JSON.stringify({
        type: 'subscribe-category',
        payload: { categoryId }
      }));
      
      toast({
        title: "Subscribed",
        description: "You'll receive notifications for this category",
      });
    } catch (error) {
      console.error('Error subscribing to category:', error);
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Group events by date for the calendar view
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    if (!acc[date]) {
      acc[date] = [];
    }
    
    acc[date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);
  
  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new-video':
        return (
          <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-purple-500 dark:text-purple-300"
            >
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
        );
        
      case 'featured':
        return (
          <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-amber-500 dark:text-amber-300"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
        );
        
      case 'membership':
        return (
          <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-indigo-500 dark:text-indigo-300"
            >
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
              <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path>
            </svg>
          </div>
        );
        
      case 'system':
        return (
          <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-gray-500 dark:text-gray-400"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
        );
        
      default:
        return (
          <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-500 dark:text-blue-300" />
          </div>
        );
    }
  };
  
  // Get event icon based on type
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'new-video':
        return (
          <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-purple-500 dark:text-purple-300"
            >
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
        );
        
      case 'featured':
        return (
          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-amber-500 dark:text-amber-300"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
        );
        
      case 'event':
        return (
          <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-green-500 dark:text-green-300"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
        );
        
      case 'promotion':
        return (
          <div className="h-8 w-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-pink-500 dark:text-pink-300"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
        );
        
      default:
        return (
          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-blue-500 dark:text-blue-300" />
          </div>
        );
    }
  };
  
  if (!user) return null;
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[360px] p-0 max-h-[500px] flex flex-col" 
        align="end" 
        sideOffset={5}
      >
        <Tabs 
          defaultValue="notifications" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col flex-grow h-full"
        >
          <div className="flex items-center justify-between border-b px-4 py-2">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="notifications" className="text-sm">
                Notifications
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-sm">
                <CalendarDays className="h-4 w-4 mr-2" />
                Calendar
              </TabsTrigger>
            </TabsList>
            
            {activeTab === "notifications" && notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8 px-2"
                onClick={() => markAsRead()}
              >
                Mark all read
              </Button>
            )}
          </div>
          
          <TabsContent 
            value="notifications" 
            className="flex-grow overflow-y-auto p-0 m-0 max-h-[400px]"
          >
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
                <Bell className="h-10 w-10 text-muted-foreground mb-2" />
                <h3 className="font-medium">No notifications</h3>
                <p className="text-sm text-muted-foreground">
                  We'll notify you when there's something new
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors ${
                      notification.read ? '' : 'bg-muted/30'
                    }`}
                  >
                    {getNotificationIcon(notification.type)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        {!notification.read && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 -mt-1 -mr-1"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2 text-muted-foreground">
                        {notification.message}
                      </p>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatDate(notification.timestamp)}
                      </span>
                      
                      {notification.data?.link && (
                        <a 
                          href={notification.data.link}
                          className="text-xs text-primary flex items-center mt-1"
                        >
                          View details
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent 
            value="calendar" 
            className="flex-grow overflow-y-auto p-0 m-0 max-h-[400px]"
          >
            {Object.keys(groupedEvents).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
                <Calendar className="h-10 w-10 text-muted-foreground mb-2" />
                <h3 className="font-medium">No upcoming events</h3>
                <p className="text-sm text-muted-foreground">
                  Check back later for new events
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-5">
                {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                  <div key={date}>
                    <div className="flex items-center mb-2">
                      <div className="h-2 w-2 rounded-full bg-primary mr-2"></div>
                      <h3 className="font-semibold text-sm">{date}</h3>
                    </div>
                    
                    <div className="space-y-3 pl-4">
                      {dateEvents.map((event) => (
                        <div key={event.id} className="flex items-start gap-3">
                          {getEventIcon(event.type)}
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {event.description}
                              </p>
                            )}
                            
                            <div className="text-xs flex items-center mt-1">
                              <span className="text-muted-foreground">
                                {new Date(event.date).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              
                              {event.link && (
                                <a 
                                  href={event.link}
                                  className="text-xs text-primary flex items-center ml-2"
                                >
                                  Details
                                  <ChevronRight className="h-3 w-3 ml-0.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="p-2 border-t text-xs text-center text-muted-foreground">
          {isConnected ? (
            <span className="flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
              Connected to notifications
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5"></span>
              Reconnecting...
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}