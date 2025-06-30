// Membership plans
export const MEMBERSHIP_PLANS = {
  MONTHLY: {
    id: 1,
    name: "Monthly",
    price: 200,
    billingCycle: "monthly",
    downloadLimit: 25,
  },
  QUARTERLY: {
    id: 2,
    name: "Quarterly",
    price: 250,
    billingCycle: "quarterly",
    downloadLimit: 40,
  },
  ANNUAL: {
    id: 3,
    name: "Annual",
    price: 300,
    billingCycle: "annual",
    downloadLimit: Infinity, // Unlimited
  },
};

// Main genre categories
export const VIDEO_CATEGORIES = [
  { id: 1, name: "Hip-Hop", slug: "hip-hop", iconName: "Sparkles", itemCount: 250 },
  { id: 2, name: "Pop", slug: "pop", iconName: "ArrowsUpFromLine", itemCount: 180 },
  { id: 3, name: "Dance", slug: "dance", iconName: "Waves", itemCount: 120 },
  { id: 4, name: "Country", slug: "country", iconName: "Cube", itemCount: 95 },
  { id: 5, name: "Reggae", slug: "reggae", iconName: "Film", itemCount: 310 },
  { id: 6, name: "R&B", slug: "r-and-b", iconName: "Zap", itemCount: 175 },
  { id: 7, name: "Reggaeton", slug: "reggaeton", iconName: "Sparkles", itemCount: 85 },
  { id: 8, name: "House", slug: "house", iconName: "Waves", itemCount: 200 },
  { id: 9, name: "Alternative", slug: "alternative", iconName: "Film", itemCount: 75 },
];

// Visual type categories (now in dropdown)
export const VISUAL_CATEGORIES = [
  { id: 101, name: "Visuals", slug: "visuals", iconName: "Sparkles", itemCount: 250 },
  { id: 102, name: "Transitions", slug: "transitions", iconName: "ArrowsUpFromLine", itemCount: 180 },
  { id: 103, name: "Audio React", slug: "audio-react", iconName: "Waves", itemCount: 120 },
  { id: 104, name: "3D Elements", slug: "3d-elements", iconName: "Cube", itemCount: 95 },
  { id: 105, name: "Loops", slug: "loops", iconName: "Film", itemCount: 310 },
  { id: 106, name: "Effects", slug: "effects", iconName: "Zap", itemCount: 175 },
];

// Video resolutions
export const VIDEO_RESOLUTIONS = {
  "4K": "3840x2160",
  "HD": "1920x1080",
  "8K": "7680x4320",
};

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  VIDEOS: {
    LIST: "/api/videos",
    FEATURED: "/api/videos/featured",
    DETAIL: (id: number) => `/api/videos/${id}`,
    DOWNLOAD: (id: number) => `/api/videos/${id}/download`,
    PREVIEW: (id: number) => `/api/videos/${id}/preview`,
  },
  CATEGORIES: {
    LIST: "/api/categories",
    DETAIL: (id: number) => `/api/categories/${id}`,
  },
  MEMBERSHIPS: {
    LIST: "/api/memberships",
    SUBSCRIBE: "/api/memberships/subscribe",
  },
  USER: {
    DOWNLOADS: "/api/user/downloads",
    PROFILE: "/api/user/profile",
    UPDATE_PROFILE: "/api/user/profile",
  },
  ADMIN: {
    USERS: "/api/admin/users",
    VIDEOS: "/api/admin/videos",
    STATISTICS: "/api/admin/statistics",
  },
};
