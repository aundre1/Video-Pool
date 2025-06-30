import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/queryClient';

/**
 * Custom hook for handling video authentication and access checks
 */
export function useVideoAuth() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Check if user has access to a specific video
   */
  const checkVideoAccess = async (videoId: number) => {
    if (!isAuthenticated) {
      return { hasAccess: false, reason: 'not-authenticated' };
    }
    
    try {
      const response = await fetch(`/api/videos/${videoId}/access-check`);
      const data = await response.json();
      
      return {
        hasAccess: data.hasAccess,
        reason: data.reason,
        isPremium: data.isPremium,
        requiresMembership: data.requiresMembership
      };
    } catch (error) {
      console.error('Error checking video access:', error);
      return { hasAccess: false, reason: 'error' };
    }
  };
  
  /**
   * Get a secure streaming token for a video
   */
  const getStreamingToken = async (videoId: number) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to get streaming token');
    }
    
    try {
      const response = await fetch(`/api/videos/${videoId}/token`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get streaming token');
      }
      
      const data = await response.json();
      return data.token;
    } catch (error: any) {
      console.error('Error getting streaming token:', error);
      throw new Error(error.message || 'Failed to get streaming token');
    }
  };
  
  /**
   * Handle video download request
   */
  const downloadVideo = useMutation({
    mutationFn: async (videoId: number) => {
      if (!isAuthenticated) {
        throw new Error('Must be logged in to download');
      }
      
      setIsProcessing(true);
      
      try {
        // First check if user has enough download credits
        const accessCheck = await checkVideoAccess(videoId);
        
        if (!accessCheck.hasAccess) {
          throw new Error(
            accessCheck.reason === 'membership-expired' 
              ? 'Your membership has expired. Please renew to continue downloading.'
              : accessCheck.reason === 'no-downloads-remaining'
              ? 'You have reached your download limit for this month.'
              : 'You do not have access to download this video.'
          );
        }
        
        // Trigger the download
        const response = await fetch(`/api/videos/${videoId}/download`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to download video');
        }
        
        // Get the download URL
        const data = await response.json();
        
        // Force download by creating a temporary link
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.fileName || `video-${videoId}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        return { success: true };
      } catch (error: any) {
        console.error('Error downloading video:', error);
        throw new Error(error.message || 'Failed to download video');
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Download started',
        description: 'Your video is downloading now.',
      });
      
      // Refresh user data to update download counts
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Download failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  /**
   * Request bulk download of multiple videos
   */
  const bulkDownload = useMutation({
    mutationFn: async (videoIds: number[]) => {
      if (!isAuthenticated) {
        throw new Error('Must be logged in to download');
      }
      
      if (videoIds.length === 0) {
        throw new Error('No videos selected for download');
      }
      
      setIsProcessing(true);
      
      try {
        const response = await fetch('/api/videos/bulk-download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoIds }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to prepare bulk download');
        }
        
        const data = await response.json();
        
        // Force download by creating a temporary link
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.fileName || 'videos.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        return { success: true };
      } catch (error: any) {
        console.error('Error preparing bulk download:', error);
        throw new Error(error.message || 'Failed to prepare bulk download');
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Bulk download started',
        description: 'Your videos are being prepared and will download as a zip file.',
      });
      
      // Refresh user data to update download counts
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk download failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Get user's remaining downloads (if authenticated)
  const { data: downloadInfo } = useQuery({
    queryKey: ['/api/auth/user/downloads'],
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  
  return {
    isProcessing,
    downloadInfo,
    checkVideoAccess,
    getStreamingToken,
    downloadVideo,
    bulkDownload,
  };
}