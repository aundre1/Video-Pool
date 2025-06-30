import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  Film, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash, 
  Eye,
  Download 
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { format } from "date-fns";
import { Video } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function AdminVideos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [videosPerPage] = useState(10);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Redirect if not admin
  if (!user || user.role !== "admin") {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access the admin area",
      variant: "destructive",
    });
    return <Redirect to="/" />;
  }
  
  // Fetch videos with search and pagination
  const { data, isLoading } = useQuery<{ videos: Video[], total: number }>({
    queryKey: ['/api/admin/videos', searchTerm, page, videosPerPage],
  });
  
  // Delete video mutation
  const deleteMutation = useMutation({
    mutationFn: async (videoId: number) => {
      return apiRequest("DELETE", `/api/admin/videos/${videoId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Video Deleted",
        description: "The video has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/videos'] });
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete video",
        variant: "destructive",
      });
    },
  });
  
  const handleDeleteClick = (videoId: number) => {
    setVideoToDelete(videoId);
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = () => {
    if (videoToDelete) {
      deleteMutation.mutate(videoToDelete);
    }
  };
  
  // Pagination calculations
  const totalVideos = data?.total || 0;
  const totalPages = Math.ceil(totalVideos / videosPerPage);
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Helmet>
        <title>Manage Videos - VideoPool Pro Admin</title>
        <meta name="description" content="Admin interface for managing video content" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manage Videos</h1>
            <p className="text-muted-foreground">
              Add, edit, and manage your video content
            </p>
          </div>
          
          <Link href="/admin/videos/new">
            <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" /> Add New Video
            </Button>
          </Link>
        </div>
        
        <Card className="bg-dark-card border-dark-border mb-8">
          <CardHeader>
            <CardTitle>Video Library</CardTitle>
            <CardDescription>
              Manage your library of video content
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <Input 
                  placeholder="Search videos..." 
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1); // Reset to first page on search
                  }}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            
            {/* Videos table */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : data?.videos && data.videos.length > 0 ? (
              <>
                <div className="rounded-md border border-dark-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-dark-lighter">
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead className="w-[250px]">Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Resolution</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Downloads</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.videos.map((video) => (
                        <TableRow key={video.id} className="hover:bg-dark-lighter">
                          <TableCell className="font-medium">{video.id}</TableCell>
                          <TableCell>{video.title}</TableCell>
                          <TableCell>{video.categoryId}</TableCell>
                          <TableCell>{formatDuration(video.duration)}</TableCell>
                          <TableCell>{video.resolution}</TableCell>
                          <TableCell>{video.isLoop ? "Loop" : "Clip"}</TableCell>
                          <TableCell>{video.downloadCount}</TableCell>
                          <TableCell>
                            {format(new Date(video.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setLocation(`/video/${video.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLocation(`/admin/videos/edit/${video.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteClick(video.id)}>
                                  <Trash className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            // Show all pages if 5 or fewer
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            // Near the start
                            pageNum = i + 1;
                            if (i === 4) pageNum = totalPages;
                          } else if (page >= totalPages - 2) {
                            // Near the end
                            pageNum = totalPages - 4 + i;
                            if (i === 0) pageNum = 1;
                          } else {
                            // In the middle
                            pageNum = page - 2 + i;
                            if (i === 0) pageNum = 1;
                            if (i === 4) pageNum = totalPages;
                          }
                          
                          if ((i === 1 && pageNum !== 2) || (i === 3 && pageNum !== totalPages - 1)) {
                            return (
                              <PaginationItem key={i}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          
                          return (
                            <PaginationItem key={i}>
                              <PaginationLink
                                isActive={page === pageNum}
                                onClick={() => setPage(pageNum)}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Film className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">No videos found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm 
                    ? "No videos match your search criteria"
                    : "Start adding videos to your library"
                  }
                </p>
                <Link href="/admin/videos/new">
                  <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                    <Plus className="mr-2 h-4 w-4" /> Add New Video
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="text-lg">Total Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Film className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">{totalVideos}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="text-lg">Total Downloads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Download className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">
                  {data?.videos.reduce((acc, video) => acc + video.downloadCount, 0) || 0}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="text-lg">Average Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <div className="text-2xl font-bold">
                  {data?.videos.length 
                    ? formatDuration(
                        Math.floor(
                          data.videos.reduce((acc, video) => acc + video.duration, 0) / data.videos.length
                        )
                      )
                    : "0:00"
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-dark-card border-dark-border">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this video? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
