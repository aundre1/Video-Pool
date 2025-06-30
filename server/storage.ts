import { 
  users, 
  memberships, 
  categories, 
  videos, 
  downloads, 
  type User, 
  type InsertUser, 
  type Membership, 
  type InsertMembership,
  type Category,
  type InsertCategory,
  type Video,
  type InsertVideo,
  type Download,
  type InsertDownload
} from "@shared/schema";

// Storage interface for all CRUD operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(filter?: { searchTerm?: string, membershipId?: number, page?: number, limit?: number }): Promise<{ users: User[], total: number }>;
  
  // Membership operations
  getMembership(id: number): Promise<Membership | undefined>;
  getAllMemberships(): Promise<Membership[]>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(id: number, membershipData: Partial<Membership>): Promise<Membership | undefined>;
  deleteMembership(id: number): Promise<boolean>;
  
  // Category operations
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Video operations
  getVideo(id: number): Promise<Video | undefined>;
  getAllVideos(filter?: { searchTerm?: string, categoryId?: number, isPremium?: boolean, isLoop?: boolean, sortBy?: string, page?: number, limit?: number }): Promise<{ videos: Video[], total: number }>;
  getFeaturedVideos(filter?: { type?: string, limit?: number }): Promise<Video[]>;
  getVideosByCategory(categoryId: number, page?: number, limit?: number): Promise<{ videos: Video[], total: number }>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: number, videoData: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: number): Promise<boolean>;
  incrementVideoDownloadCount(id: number): Promise<void>;
  
  // Batch video operations
  batchDeleteVideos(videoIds: number[]): Promise<{ success: boolean, deletedCount: number }>;
  batchUpdateVideoCategory(videoIds: number[], categoryId: number): Promise<{ success: boolean, updatedCount: number }>;
  batchUpdateVideoPremiumStatus(videoIds: number[], isPremium: boolean): Promise<{ success: boolean, updatedCount: number }>;
  batchUpdateVideoFeaturedStatus(videoIds: number[], isNew: boolean): Promise<{ success: boolean, updatedCount: number }>;
  
  // Download operations
  createDownload(download: InsertDownload): Promise<Download>;
  getUserDownloads(userId: number): Promise<Download[]>;
  getRecentUserDownloads(userId: number, limit: number): Promise<(Download & { video: Video })[]>;
  
  // Stats operations
  getStatistics(): Promise<{
    totalUsers: number;
    totalVideos: number;
    totalDownloads: number;
    activeMemberships: number;
    downloadsToday: number;
  }>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private memberships: Map<number, Membership>;
  private categories: Map<number, Category>;
  private videos: Map<number, Video>;
  private downloads: Map<number, Download>;
  
  private userIdCounter: number;
  private membershipIdCounter: number;
  private categoryIdCounter: number;
  private videoIdCounter: number;
  private downloadIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.memberships = new Map();
    this.categories = new Map();
    this.videos = new Map();
    this.downloads = new Map();
    
    this.userIdCounter = 1;
    this.membershipIdCounter = 1;
    this.categoryIdCounter = 1;
    this.videoIdCounter = 1;
    this.downloadIdCounter = 1;
    
    // Initialize with default data
    this.initializeDefaultData();
  }
  
  private initializeDefaultData() {
    // Add default memberships
    const memberships: InsertMembership[] = [
      {
        name: "Monthly",
        price: 200,
        billingCycle: "monthly",
        downloadLimit: 25,
        features: [
          { feature: "25 downloads per month", included: true },
          { feature: "Full HD quality videos", included: true },
          { feature: "Cancel anytime", included: true },
          { feature: "Basic support", included: true },
          { feature: "4K video content", included: false },
        ],
        isPopular: false
      },
      {
        name: "Quarterly",
        price: 250,
        billingCycle: "quarterly",
        downloadLimit: 40,
        features: [
          { feature: "40 downloads per month", included: true },
          { feature: "4K video content", included: true },
          { feature: "Priority downloads", included: true },
          { feature: "Priority support", included: true },
          { feature: "Early access to new content", included: true },
        ],
        isPopular: true
      },
      {
        name: "Annual",
        price: 300,
        billingCycle: "annual",
        downloadLimit: 9999,
        features: [
          { feature: "Unlimited downloads", included: true },
          { feature: "8K video content (where available)", included: true },
          { feature: "Bulk download capability", included: true },
          { feature: "24/7 priority support", included: true },
          { feature: "Custom requests (1 per quarter)", included: true },
        ],
        isPopular: false
      }
    ];
    
    memberships.forEach(membership => this.createMembership(membership));
    
    // Add default categories
    const categories: InsertCategory[] = [
      { name: "Visuals", slug: "visuals", iconName: "Sparkles", itemCount: 0 },
      { name: "Transitions", slug: "transitions", iconName: "ArrowsUpFromLine", itemCount: 0 },
      { name: "Audio React", slug: "audio-react", iconName: "Waves", itemCount: 0 },
      { name: "3D Elements", slug: "3d-elements", iconName: "Cube", itemCount: 0 },
      { name: "Loops", slug: "loops", iconName: "Film", itemCount: 0 },
      { name: "Effects", slug: "effects", iconName: "Zap", itemCount: 0 }
    ];
    
    categories.forEach(category => this.createCategory(category));
    
    // Add admin user
    this.createUser({
      username: "admin",
      email: "admin@videopool.pro",
      password: "adminpass", // In a real app, would be hashed
      role: "admin",
    } as InsertUser);
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { 
      ...userData, 
      id,
      role: userData.role || "user",
      downloadsUsed: 0,
      downloadsRemaining: 0
    };
    
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
  
  async getAllUsers(filter?: { searchTerm?: string, membershipId?: number, page?: number, limit?: number }): Promise<{ users: User[], total: number }> {
    let users = Array.from(this.users.values());
    
    // Apply filters
    if (filter) {
      if (filter.searchTerm) {
        const searchTerm = filter.searchTerm.toLowerCase();
        users = users.filter(
          user => 
            user.username.toLowerCase().includes(searchTerm) || 
            user.email.toLowerCase().includes(searchTerm)
        );
      }
      
      if (filter.membershipId !== undefined) {
        if (filter.membershipId === 0) {
          // Filter for free users (no membership)
          users = users.filter(user => !user.membershipId);
        } else {
          // Filter for specific membership
          users = users.filter(user => user.membershipId === filter.membershipId);
        }
      }
    }
    
    const total = users.length;
    
    // Apply pagination
    if (filter?.page && filter?.limit) {
      const start = (filter.page - 1) * filter.limit;
      const end = start + filter.limit;
      users = users.slice(start, end);
    }
    
    return { users, total };
  }
  
  // Membership methods
  async getMembership(id: number): Promise<Membership | undefined> {
    return this.memberships.get(id);
  }
  
  async getAllMemberships(): Promise<Membership[]> {
    return Array.from(this.memberships.values());
  }
  
  async createMembership(membershipData: InsertMembership): Promise<Membership> {
    const id = this.membershipIdCounter++;
    const membership: Membership = { ...membershipData, id };
    
    this.memberships.set(id, membership);
    return membership;
  }
  
  async updateMembership(id: number, membershipData: Partial<Membership>): Promise<Membership | undefined> {
    const membership = this.memberships.get(id);
    if (!membership) return undefined;
    
    const updatedMembership = { ...membership, ...membershipData };
    this.memberships.set(id, updatedMembership);
    return updatedMembership;
  }
  
  async deleteMembership(id: number): Promise<boolean> {
    return this.memberships.delete(id);
  }
  
  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }
  
  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.slug === slug
    );
  }
  
  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }
  
  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const category: Category = { ...categoryData, id };
    
    this.categories.set(id, category);
    return category;
  }
  
  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;
    
    const updatedCategory = { ...category, ...categoryData };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }
  
  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    return this.videos.get(id);
  }
  
  async getAllVideos(filter?: { searchTerm?: string, categoryId?: number, isPremium?: boolean, isLoop?: boolean, sortBy?: string, page?: number, limit?: number }): Promise<{ videos: Video[], total: number }> {
    let videos = Array.from(this.videos.values());
    
    // Apply filters
    if (filter) {
      if (filter.searchTerm) {
        const searchTerm = filter.searchTerm.toLowerCase();
        videos = videos.filter(
          video => 
            video.title.toLowerCase().includes(searchTerm) || 
            video.description.toLowerCase().includes(searchTerm)
        );
      }
      
      if (filter.categoryId !== undefined) {
        videos = videos.filter(video => video.categoryId === filter.categoryId);
      }
      
      if (filter.isPremium !== undefined) {
        videos = videos.filter(video => video.isPremium === filter.isPremium);
      }
      
      if (filter.isLoop !== undefined) {
        videos = videos.filter(video => video.isLoop === filter.isLoop);
      }
      
      // Apply sorting
      if (filter.sortBy) {
        switch (filter.sortBy) {
          case 'newest':
            videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
          case 'oldest':
            videos.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            break;
          case 'popular':
            videos.sort((a, b) => b.downloadCount - a.downloadCount);
            break;
          case 'title':
            videos.sort((a, b) => a.title.localeCompare(b.title));
            break;
        }
      }
    }
    
    const total = videos.length;
    
    // Apply pagination
    if (filter?.page && filter?.limit) {
      const start = (filter.page - 1) * filter.limit;
      const end = start + filter.limit;
      videos = videos.slice(start, end);
    }
    
    return { videos, total };
  }
  
  async getFeaturedVideos(filter?: { type?: string, limit?: number }): Promise<Video[]> {
    let videos = Array.from(this.videos.values());
    
    // Apply filters
    if (filter) {
      if (filter.type === 'new') {
        videos = videos.filter(video => video.isNew);
      } else if (filter.type === 'trending') {
        // For trending, we could sort by recent downloads or views
        videos.sort((a, b) => b.downloadCount - a.downloadCount);
      } else if (filter.type === 'popular') {
        videos.sort((a, b) => b.downloadCount - a.downloadCount);
      }
      
      // Apply limit
      if (filter.limit) {
        videos = videos.slice(0, filter.limit);
      }
    }
    
    return videos;
  }
  
  async getVideosByCategory(categoryId: number, page?: number, limit?: number): Promise<{ videos: Video[], total: number }> {
    let videos = Array.from(this.videos.values()).filter(
      video => video.categoryId === categoryId
    );
    
    const total = videos.length;
    
    // Apply pagination
    if (page && limit) {
      const start = (page - 1) * limit;
      const end = start + limit;
      videos = videos.slice(start, end);
    }
    
    return { videos, total };
  }
  
  async createVideo(videoData: InsertVideo): Promise<Video> {
    const id = this.videoIdCounter++;
    const video: Video = { 
      ...videoData, 
      id,
      downloadCount: 0,
      createdAt: new Date()
    };
    
    this.videos.set(id, video);
    
    // Update category item count
    const category = this.categories.get(video.categoryId);
    if (category) {
      this.updateCategory(category.id, { itemCount: category.itemCount + 1 });
    }
    
    return video;
  }
  
  async updateVideo(id: number, videoData: Partial<Video>): Promise<Video | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;
    
    const updatedVideo = { ...video, ...videoData };
    this.videos.set(id, updatedVideo);
    
    // If category changed, update item counts
    if (videoData.categoryId && videoData.categoryId !== video.categoryId) {
      // Decrease count in old category
      const oldCategory = this.categories.get(video.categoryId);
      if (oldCategory) {
        this.updateCategory(oldCategory.id, { itemCount: oldCategory.itemCount - 1 });
      }
      
      // Increase count in new category
      const newCategory = this.categories.get(videoData.categoryId);
      if (newCategory) {
        this.updateCategory(newCategory.id, { itemCount: newCategory.itemCount + 1 });
      }
    }
    
    return updatedVideo;
  }
  
  async deleteVideo(id: number): Promise<boolean> {
    const video = this.videos.get(id);
    if (!video) return false;
    
    // Update category item count
    const category = this.categories.get(video.categoryId);
    if (category) {
      this.updateCategory(category.id, { itemCount: Math.max(0, category.itemCount - 1) });
    }
    
    return this.videos.delete(id);
  }
  
  async incrementVideoDownloadCount(id: number): Promise<void> {
    const video = this.videos.get(id);
    if (video) {
      video.downloadCount += 1;
      this.videos.set(id, video);
    }
  }
  
  // Batch operations implementations
  async batchDeleteVideos(videoIds: number[]): Promise<{ success: boolean, deletedCount: number }> {
    let deletedCount = 0;
    
    for (const videoId of videoIds) {
      const success = await this.deleteVideo(videoId);
      if (success) {
        deletedCount++;
      }
    }
    
    return {
      success: deletedCount > 0,
      deletedCount
    };
  }
  
  async batchUpdateVideoCategory(videoIds: number[], categoryId: number): Promise<{ success: boolean, updatedCount: number }> {
    // Verify category exists
    const category = await this.getCategory(categoryId);
    if (!category) {
      return { success: false, updatedCount: 0 };
    }
    
    let updatedCount = 0;
    
    for (const videoId of videoIds) {
      const updatedVideo = await this.updateVideo(videoId, { categoryId });
      if (updatedVideo) {
        updatedCount++;
      }
    }
    
    return {
      success: updatedCount > 0,
      updatedCount
    };
  }
  
  async batchUpdateVideoPremiumStatus(videoIds: number[], isPremium: boolean): Promise<{ success: boolean, updatedCount: number }> {
    let updatedCount = 0;
    
    for (const videoId of videoIds) {
      const updatedVideo = await this.updateVideo(videoId, { isPremium });
      if (updatedVideo) {
        updatedCount++;
      }
    }
    
    return {
      success: updatedCount > 0,
      updatedCount
    };
  }
  
  async batchUpdateVideoFeaturedStatus(videoIds: number[], isNew: boolean): Promise<{ success: boolean, updatedCount: number }> {
    let updatedCount = 0;
    
    for (const videoId of videoIds) {
      const updatedVideo = await this.updateVideo(videoId, { isNew });
      if (updatedVideo) {
        updatedCount++;
      }
    }
    
    return {
      success: updatedCount > 0,
      updatedCount
    };
  }
  
  // Download methods
  async createDownload(downloadData: InsertDownload): Promise<Download> {
    const id = this.downloadIdCounter++;
    const download: Download = { 
      ...downloadData, 
      id,
      downloadedAt: new Date()
    };
    
    this.downloads.set(id, download);
    
    // Increment video download count
    await this.incrementVideoDownloadCount(download.videoId);
    
    // Update user download counts
    const user = this.users.get(download.userId);
    if (user) {
      user.downloadsUsed = (user.downloadsUsed || 0) + 1;
      if (user.downloadsRemaining) {
        user.downloadsRemaining = Math.max(0, user.downloadsRemaining - 1);
      }
      this.users.set(user.id, user);
    }
    
    return download;
  }
  
  async getUserDownloads(userId: number): Promise<Download[]> {
    return Array.from(this.downloads.values())
      .filter(download => download.userId === userId)
      .sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
  }
  
  async getRecentUserDownloads(userId: number, limit: number): Promise<(Download & { video: Video })[]> {
    const downloads = Array.from(this.downloads.values())
      .filter(download => download.userId === userId)
      .sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime())
      .slice(0, limit);
    
    // Add video details to each download
    return downloads.map(download => {
      const video = this.videos.get(download.videoId);
      return {
        ...download,
        video: video as Video
      };
    });
  }
  
  // Stats methods
  async getStatistics(): Promise<{
    totalUsers: number;
    totalVideos: number;
    totalDownloads: number;
    activeMemberships: number;
    downloadsToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const downloadsToday = Array.from(this.downloads.values()).filter(
      download => new Date(download.downloadedAt) >= today
    ).length;
    
    const activeMemberships = Array.from(this.users.values()).filter(
      user => user.membershipId !== null && user.membershipId !== undefined
    ).length;
    
    return {
      totalUsers: this.users.size,
      totalVideos: this.videos.size,
      totalDownloads: this.downloads.size,
      activeMemberships,
      downloadsToday
    };
  }
}

// Export an instance of the storage
import { DatabaseStorage } from "./storage-db";

// Use database storage instead of in-memory storage
export const storage = new DatabaseStorage();
