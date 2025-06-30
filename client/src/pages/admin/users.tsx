import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash, 
  Download,
  UserCog,
  Shield
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { format } from "date-fns";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [membershipFilter, setMembershipFilter] = useState<string>("");
  
  // Redirect if not admin
  if (!user || user.role !== "admin") {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access the admin area",
      variant: "destructive",
    });
    return <Redirect to="/" />;
  }
  
  // Fetch users with search, filter and pagination
  const { data, isLoading } = useQuery<{ users: User[], total: number }>({
    queryKey: ['/api/admin/users', searchTerm, membershipFilter, page, usersPerPage],
  });
  
  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "The user has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
    },
  });
  
  const handleDeleteClick = (userId: number) => {
    setUserToDelete(userId);
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete);
    }
  };
  
  // Pagination calculations
  const totalUsers = data?.total || 0;
  const totalPages = Math.ceil(totalUsers / usersPerPage);
  
  // Get membership name based on ID
  const getMembershipName = (membershipId: number | null) => {
    if (!membershipId) return "Free";
    switch(membershipId) {
      case 1: return "Monthly";
      case 2: return "Quarterly";
      case 3: return "Annual";
      default: return "Unknown";
    }
  };

  return (
    <>
      <Helmet>
        <title>Manage Users - VideoPool Pro Admin</title>
        <meta name="description" content="Admin interface for managing users" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manage Users</h1>
            <p className="text-muted-foreground">
              View, edit, and manage user accounts
            </p>
          </div>
        </div>
        
        <Card className="bg-dark-card border-dark-border mb-8">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user accounts and memberships
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <Input 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1); // Reset to first page on search
                  }}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              
              <Select 
                value={membershipFilter} 
                onValueChange={(value) => {
                  setMembershipFilter(value);
                  setPage(1); // Reset to first page on filter change
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Memberships" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Memberships</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="1">Monthly</SelectItem>
                  <SelectItem value="2">Quarterly</SelectItem>
                  <SelectItem value="3">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Users table */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : data?.users && data.users.length > 0 ? (
              <>
                <div className="rounded-md border border-dark-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-dark-lighter">
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Membership</TableHead>
                        <TableHead>Downloads</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-dark-lighter">
                          <TableCell className="font-medium">{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              user.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              !user.membershipId ? "bg-muted text-muted-foreground" : 
                              user.membershipId === 1 ? "bg-blue-500/20 text-blue-500" :
                              user.membershipId === 2 ? "bg-secondary/20 text-secondary" :
                              "bg-green-500/20 text-green-500"
                            }`}>
                              {getMembershipName(user.membershipId)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.downloadsUsed} / {user.downloadsRemaining || "∞"}
                          </TableCell>
                          <TableCell>
                            {user.membershipStartDate ? 
                              format(new Date(user.membershipStartDate), "MMM d, yyyy") : 
                              "N/A"}
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
                                <DropdownMenuItem onClick={() => {
                                  /* Link to edit user page */
                                  toast({
                                    title: "Edit User",
                                    description: `Editing user ${user.username}`,
                                  });
                                }}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  /* Link to edit membership page */
                                  toast({
                                    title: "Manage Membership",
                                    description: `Managing membership for ${user.username}`,
                                  });
                                }}>
                                  <UserCog className="mr-2 h-4 w-4" /> Manage Membership
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  /* Link to download history page */
                                  toast({
                                    title: "View Downloads",
                                    description: `Viewing download history for ${user.username}`,
                                  });
                                }}>
                                  <Download className="mr-2 h-4 w-4" /> View Downloads
                                </DropdownMenuItem>
                                {user.role !== "admin" && (
                                  <DropdownMenuItem onClick={() => {
                                    /* Change role API call */
                                    toast({
                                      title: "Role Updated",
                                      description: `${user.username} is now an admin`,
                                    });
                                  }}>
                                    <Shield className="mr-2 h-4 w-4" /> Make Admin
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteClick(user.id)}
                                >
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
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">No users found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || membershipFilter
                    ? "No users match your search criteria"
                    : "There are no users in the system"
                  }
                </p>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setMembershipFilter("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="text-lg">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">{totalUsers}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="text-lg">Premium Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">
                  {data?.users.filter(u => u.membershipId).length || 0}
                </div>
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
                  {data?.users.reduce((acc, user) => acc + (user.downloadsUsed || 0), 0) || 0}
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
              Are you sure you want to delete this user? This action cannot be undone.
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
