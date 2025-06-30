import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Send, Trash, Calendar, RefreshCw, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

// Campaign form schema
const campaignFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  subject: z.string().min(3, { message: "Subject must be at least 3 characters" }),
  htmlContent: z.string().min(10, { message: "HTML content must be at least 10 characters" }),
  textContent: z.string().min(10, { message: "Text content must be at least 10 characters" }),
  sendRate: z.number().min(1).max(1000).optional(),
  scheduledTime: z.string().optional(),
  segmentOptions: z.object({
    membershipId: z.number().nullable().optional(),
    lastLoginDays: z.number().optional(),
    inactiveOnly: z.boolean().optional(),
    downloadsMin: z.number().optional(),
    downloadsMax: z.number().optional()
  }).optional()
});

// Import users schema
const importFormSchema = z.object({
  usersData: z.string().min(10, { message: "Please provide valid JSON data" })
});

// Newsletter generation schema
const newsletterFormSchema = z.object({
  topVideoIds: z.string(),
  promotionalText: z.string().min(10, { message: "Promotional text must be at least 10 characters" }),
  userSegment: z.string().optional()
});

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'complete';

interface Campaign {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  status: CampaignStatus;
  sendRate: number;
  scheduledTime: string | null;
  segmentOptions: any;
  createdAt: string;
  updatedAt: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
}

interface Subscriber {
  id: number;
  email: string;
  isSubscribed: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
  username: string | null;
}

export default function AdminEmailPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<
    "create" | "edit" | "schedule" | "import" | "newsletter"
  >("create");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [importFormat, setImportFormat] = useState<string>("");
  const [generatedNewsletter, setGeneratedNewsletter] = useState<{
    subject: string;
    htmlContent: string;
    textContent: string;
  } | null>(null);

  // Query for campaigns
  const campaignsQuery = useQuery({
    queryKey: ['/api/admin/email/campaigns'],
    enabled: activeTab === "campaigns",
  });

  // Query for subscribers
  const subscribersQuery = useQuery({
    queryKey: ['/api/admin/email/subscribers'],
    enabled: activeTab === "subscribers",
  });

  // Query for memberships (used in segment selection)
  const membershipsQuery = useQuery({
    queryKey: ['/api/memberships'],
  });

  // Campaign form
  const campaignForm = useForm<z.infer<typeof campaignFormSchema>>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      subject: "",
      htmlContent: "",
      textContent: "",
      sendRate: 100,
      segmentOptions: {
        membershipId: null,
        inactiveOnly: false
      }
    }
  });

  // Import form
  const importForm = useForm<z.infer<typeof importFormSchema>>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      usersData: ""
    }
  });

  // Newsletter form
  const newsletterForm = useForm<z.infer<typeof newsletterFormSchema>>({
    resolver: zodResolver(newsletterFormSchema),
    defaultValues: {
      topVideoIds: "",
      promotionalText: "",
      userSegment: ""
    }
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: (data: z.infer<typeof campaignFormSchema>) => 
      apiRequest('POST', '/api/admin/email/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/campaigns'] });
      toast({
        title: "Campaign created",
        description: "Your email campaign has been created successfully",
      });
      setOpenDialog(false);
      campaignForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating campaign",
        description: error.message || "Failed to create campaign",
        variant: "destructive"
      });
    }
  });

  // Update campaign mutation
  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: z.infer<typeof campaignFormSchema> }) => 
      apiRequest('PUT', `/api/admin/email/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/campaigns'] });
      toast({
        title: "Campaign updated",
        description: "Your email campaign has been updated successfully",
      });
      setOpenDialog(false);
      campaignForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating campaign",
        description: error.message || "Failed to update campaign",
        variant: "destructive"
      });
    }
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/admin/email/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/campaigns'] });
      toast({
        title: "Campaign deleted",
        description: "The email campaign has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting campaign",
        description: error.message || "Failed to delete campaign",
        variant: "destructive"
      });
    }
  });

  // Schedule campaign mutation
  const scheduleCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: { scheduledTime: string, sendRate?: number } }) => 
      apiRequest('POST', `/api/admin/email/campaigns/${id}/schedule`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/campaigns'] });
      toast({
        title: "Campaign scheduled",
        description: "Your email campaign has been scheduled successfully",
      });
      setOpenDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error scheduling campaign",
        description: error.message || "Failed to schedule campaign",
        variant: "destructive"
      });
    }
  });

  // Send campaign now mutation
  const sendCampaignMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/admin/email/campaigns/${id}/send`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/campaigns'] });
      toast({
        title: "Campaign sending",
        description: `Your email campaign is being sent to ${data.recipientCount} recipients`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending campaign",
        description: error.message || "Failed to send campaign",
        variant: "destructive"
      });
    }
  });

  // Import users mutation
  const importUsersMutation = useMutation({
    mutationFn: (data: { users: { email: string, username?: string, isSubscribed?: boolean }[] }) => 
      apiRequest('POST', '/api/admin/email/import-users', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/subscribers'] });
      toast({
        title: "Users imported",
        description: `Imported ${data.importedCount.created} new users and updated ${data.importedCount.updated} existing users`,
      });
      setOpenDialog(false);
      importForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error importing users",
        description: error.message || "Failed to import users",
        variant: "destructive"
      });
    }
  });

  // Generate newsletter mutation
  const generateNewsletterMutation = useMutation({
    mutationFn: (data: { topVideoIds: number[], promotionalText: string, userSegment?: string }) => 
      apiRequest('POST', '/api/admin/email/generate-newsletter', data),
    onSuccess: (data) => {
      setGeneratedNewsletter(data);
      toast({
        title: "Newsletter generated",
        description: "Your newsletter content has been generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error generating newsletter",
        description: error.message || "Failed to generate newsletter",
        variant: "destructive"
      });
    }
  });

  // Update subscriber mutation
  const updateSubscriberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: { isSubscribed: boolean } }) => 
      apiRequest('PUT', `/api/admin/email/subscribers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email/subscribers'] });
      toast({
        title: "Subscriber updated",
        description: "The subscriber's status has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating subscriber",
        description: error.message || "Failed to update subscriber",
        variant: "destructive"
      });
    }
  });

  const handleCreateCampaign = () => {
    setDialogMode("create");
    campaignForm.reset({
      name: "",
      subject: "",
      htmlContent: "",
      textContent: "",
      sendRate: 100,
      segmentOptions: {
        membershipId: null,
        inactiveOnly: false
      }
    });
    setSelectedCampaign(null);
    setOpenDialog(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setDialogMode("edit");
    setSelectedCampaign(campaign);
    campaignForm.reset({
      name: campaign.name,
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      textContent: campaign.textContent,
      sendRate: campaign.sendRate,
      segmentOptions: campaign.segmentOptions || {
        membershipId: null,
        inactiveOnly: false
      }
    });
    setOpenDialog(true);
  };

  const handleScheduleCampaign = (campaign: Campaign) => {
    setDialogMode("schedule");
    setSelectedCampaign(campaign);
    // Set default scheduled time to tomorrow at same time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    campaignForm.setValue("scheduledTime", tomorrow.toISOString().substring(0, 16));
    campaignForm.setValue("sendRate", campaign.sendRate || 100);
    setOpenDialog(true);
  };

  const handleImportUsers = () => {
    setDialogMode("import");
    setOpenDialog(true);
    // Show example import format
    setImportFormat(JSON.stringify({
      users: [
        { email: "user1@example.com", username: "User1", isSubscribed: true },
        { email: "user2@example.com", username: "User2" }
      ]
    }, null, 2));
  };

  const handleGenerateNewsletter = () => {
    setDialogMode("newsletter");
    setGeneratedNewsletter(null);
    setOpenDialog(true);
  };

  const handleUseGeneratedNewsletter = () => {
    if (generatedNewsletter) {
      campaignForm.setValue("subject", generatedNewsletter.subject);
      campaignForm.setValue("htmlContent", generatedNewsletter.htmlContent);
      campaignForm.setValue("textContent", generatedNewsletter.textContent);
      setDialogMode("create");
      setGeneratedNewsletter(null);
    }
  };

  const onCampaignSubmit = (data: z.infer<typeof campaignFormSchema>) => {
    if (dialogMode === "edit" && selectedCampaign) {
      updateCampaignMutation.mutate({ id: selectedCampaign.id, data });
    } else {
      createCampaignMutation.mutate(data);
    }
  };

  const onScheduleSubmit = () => {
    if (selectedCampaign && campaignForm.getValues().scheduledTime) {
      scheduleCampaignMutation.mutate({
        id: selectedCampaign.id,
        data: {
          scheduledTime: campaignForm.getValues().scheduledTime,
          sendRate: campaignForm.getValues().sendRate
        }
      });
    }
  };

  const onImportSubmit = (data: z.infer<typeof importFormSchema>) => {
    try {
      const parsedData = JSON.parse(data.usersData);
      importUsersMutation.mutate(parsedData);
    } catch (error) {
      toast({
        title: "Invalid JSON data",
        description: "Please provide valid JSON data in the correct format",
        variant: "destructive"
      });
    }
  };

  const onNewsletterSubmit = (data: z.infer<typeof newsletterFormSchema>) => {
    try {
      // Convert comma-separated video IDs to array of numbers
      const videoIds = data.topVideoIds.split(',').map(id => parseInt(id.trim()));
      
      generateNewsletterMutation.mutate({
        topVideoIds: videoIds,
        promotionalText: data.promotionalText,
        userSegment: data.userSegment || undefined
      });
    } catch (error) {
      toast({
        title: "Error generating newsletter",
        description: "Please check your input data and try again",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "sending":
        return <Badge variant="default" className="bg-amber-500">Sending</Badge>;
      case "complete":
        return <Badge variant="default" className="bg-green-500">Complete</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  return (
    <div className="container px-4 py-8">
      <Helmet>
        <title>Email Marketing - TheVideoPool Admin</title>
      </Helmet>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Marketing</h1>
          <p className="text-muted-foreground">Manage email campaigns and subscribers</p>
        </div>
        <div className="flex space-x-2">
          {activeTab === "campaigns" && (
            <>
              <Button onClick={handleCreateCampaign}>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
              <Button onClick={handleGenerateNewsletter} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                AI Newsletter
              </Button>
            </>
          )}
          {activeTab === "subscribers" && (
            <Button onClick={handleImportUsers}>
              <Upload className="h-4 w-4 mr-2" />
              Import Users
            </Button>
          )}
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Email Campaigns</CardTitle>
              <CardDescription>
                Create and manage your email marketing campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : campaignsQuery.error ? (
                <div className="text-center py-8 text-red-500">
                  Error loading campaigns. Please try again.
                </div>
              ) : campaignsQuery.data?.campaigns?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No campaigns found. Create your first campaign to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignsQuery.data?.campaigns?.map((campaign: Campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>{campaign.subject}</TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell>{formatDate(campaign.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              {campaign.status === "draft" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditCampaign(campaign)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleScheduleCampaign(campaign)}
                                  >
                                    <Calendar className="h-4 w-4 mr-1" />
                                    Schedule
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => sendCampaignMutation.mutate(campaign.id)}
                                    disabled={sendCampaignMutation.isPending}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Send Now
                                  </Button>
                                </>
                              )}
                              {campaign.status === "scheduled" && (
                                <Button
                                  size="sm"
                                  onClick={() => sendCampaignMutation.mutate(campaign.id)}
                                  disabled={sendCampaignMutation.isPending}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Send Now
                                </Button>
                              )}
                              {(campaign.status === "draft" || campaign.status === "scheduled") && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                                  disabled={deleteCampaignMutation.isPending}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="subscribers">
          <Card>
            <CardHeader>
              <CardTitle>Email Subscribers</CardTitle>
              <CardDescription>
                Manage your email subscribers and subscription status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscribersQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : subscribersQuery.error ? (
                <div className="text-center py-8 text-red-500">
                  Error loading subscribers. Please try again.
                </div>
              ) : subscribersQuery.data?.subscribers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No subscribers found. Import users to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Subscribed Since</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscribersQuery.data?.subscribers?.map((subscriber: Subscriber) => (
                        <TableRow key={subscriber.id}>
                          <TableCell className="font-medium">{subscriber.email}</TableCell>
                          <TableCell>{subscriber.username || "N/A"}</TableCell>
                          <TableCell>
                            {subscriber.isSubscribed ? (
                              <Badge variant="default" className="bg-green-500">Subscribed</Badge>
                            ) : (
                              <Badge variant="outline">Unsubscribed</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(subscriber.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={subscriber.isSubscribed ? "destructive" : "default"}
                              size="sm"
                              onClick={() => updateSubscriberMutation.mutate({
                                id: subscriber.id,
                                data: { isSubscribed: !subscriber.isSubscribed }
                              })}
                              disabled={updateSubscriberMutation.isPending}
                            >
                              {subscriber.isSubscribed ? "Unsubscribe" : "Resubscribe"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog for campaign creation/editing */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {dialogMode === "create" || dialogMode === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialogMode === "create" ? "Create New Campaign" : "Edit Campaign"}
                </DialogTitle>
                <DialogDescription>
                  {dialogMode === "create"
                    ? "Create a new email campaign to send to your subscribers"
                    : "Edit your email campaign details"}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...campaignForm}>
                <form onSubmit={campaignForm.handleSubmit(onCampaignSubmit)} className="space-y-6">
                  <FormField
                    control={campaignForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Monthly Newsletter" />
                        </FormControl>
                        <FormDescription>
                          Internal name for your campaign
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={campaignForm.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Subject</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="New videos available at TheVideoPool" />
                        </FormControl>
                        <FormDescription>
                          Subject line for the email
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={campaignForm.control}
                    name="htmlContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HTML Content</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="<h1>Hello {{username}},</h1>"
                            className="font-mono h-[200px]"
                          />
                        </FormControl>
                        <FormDescription>
                          HTML content of your email. Use {{username}}, {{email}}, etc. for personalization.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={campaignForm.control}
                    name="textContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text Content</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Hello {{username}},"
                            className="font-mono h-[150px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Plain text alternative for email clients that don't support HTML
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={campaignForm.control}
                    name="sendRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Send Rate (emails per hour)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Limit how many emails are sent per hour to manage costs
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={campaignForm.control}
                    name="segmentOptions.membershipId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Membership</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "all" ? null : parseInt(value))}
                          defaultValue={field.value === null ? "all" : field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select membership tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Members</SelectItem>
                            <SelectItem value="0">Non-members</SelectItem>
                            {membershipsQuery.data?.map((membership: any) => (
                              <SelectItem key={membership.id} value={membership.id.toString()}>
                                {membership.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Target users with specific membership or all users
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                    >
                      {(createCampaignMutation.isPending || updateCampaignMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {dialogMode === "create" ? "Create Campaign" : "Update Campaign"}
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          ) : dialogMode === "schedule" ? (
            <>
              <DialogHeader>
                <DialogTitle>Schedule Campaign</DialogTitle>
                <DialogDescription>
                  Schedule when this campaign should be sent
                </DialogDescription>
              </DialogHeader>
              
              <Form {...campaignForm}>
                <form onSubmit={campaignForm.handleSubmit(onScheduleSubmit)} className="space-y-6">
                  <FormField
                    control={campaignForm.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule Date & Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={campaignForm.control}
                    name="sendRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Send Rate (emails per hour)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Limit how many emails are sent per hour to manage costs
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={scheduleCampaignMutation.isPending}
                    >
                      {scheduleCampaignMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Schedule Campaign
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          ) : dialogMode === "import" ? (
            <>
              <DialogHeader>
                <DialogTitle>Import Subscribers</DialogTitle>
                <DialogDescription>
                  Import users from your existing database
                </DialogDescription>
              </DialogHeader>
              
              <Form {...importForm}>
                <form onSubmit={importForm.handleSubmit(onImportSubmit)} className="space-y-6">
                  <FormField
                    control={importForm.control}
                    name="usersData"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Data (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={importFormat}
                            className="font-mono h-[300px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Paste JSON data in the format shown in the example
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={importUsersMutation.isPending}
                    >
                      {importUsersMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Import Users
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          ) : dialogMode === "newsletter" ? (
            <>
              <DialogHeader>
                <DialogTitle>Generate AI Newsletter</DialogTitle>
                <DialogDescription>
                  Use AI to generate a newsletter with your latest content
                </DialogDescription>
              </DialogHeader>
              
              {generatedNewsletter ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">Generated Subject</h3>
                      <div className="bg-muted p-3 rounded-md">{generatedNewsletter.subject}</div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-1">Generated HTML Content</h3>
                      <ScrollArea className="h-[250px] w-full rounded-md border">
                        <div className="p-4 font-mono text-sm">
                          {generatedNewsletter.htmlContent}
                        </div>
                      </ScrollArea>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-1">Generated Text Content</h3>
                      <ScrollArea className="h-[100px] w-full rounded-md border">
                        <div className="p-4 font-mono text-sm">
                          {generatedNewsletter.textContent}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setGeneratedNewsletter(null)}
                    >
                      Generate Again
                    </Button>
                    <Button onClick={handleUseGeneratedNewsletter}>
                      Use This Content
                    </Button>
                  </div>
                </>
              ) : (
                <Form {...newsletterForm}>
                  <form onSubmit={newsletterForm.handleSubmit(onNewsletterSubmit)} className="space-y-6">
                    <FormField
                      control={newsletterForm.control}
                      name="promotionalText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Promotional Message</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Check out our latest DJ video content, including exclusive new releases!"
                              className="h-[100px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Main promotional message to include in the newsletter
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={newsletterForm.control}
                      name="topVideoIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Featured Video IDs</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="1,2,3,4"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter comma-separated IDs of videos to feature
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={newsletterForm.control}
                      name="userSegment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User Segment</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Monthly Members"
                            />
                          </FormControl>
                          <FormDescription>
                            Optional: Name of user segment to personalize content for
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpenDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={generateNewsletterMutation.isPending}
                      >
                        {generateNewsletterMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Generate Newsletter
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}