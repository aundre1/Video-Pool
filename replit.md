# VideoPool Pro - Premium Video Content for DJs

## Overview

VideoPool Pro is a full-stack web application designed to serve as a marketplace for premium video content targeting DJs. The platform allows users to browse, preview, and download high-quality video content with a membership-based model. The application includes user authentication, membership plans, video categories, and admin functionality for managing users and content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with a custom dark theme
- **UI Components**: ShadCN UI component library based on Radix UI primitives
- **State Management**: React Query for server state, React Context for authentication
- **Routing**: Wouter for lightweight client-side routing

The frontend follows a component-based architecture with shared UI components and page-specific components. The UI is designed with a dark theme optimized for visual content, with accent colors in purple and pink gradients.

### Backend

- **Framework**: Express.js with TypeScript
- **Database Access**: Drizzle ORM for database operations
- **Authentication**: JWT-based authentication stored in HTTP-only cookies
- **API**: RESTful API endpoints organized by resource types

The backend follows a controller-service-repository pattern, separating the API endpoints (controllers) from business logic (services) and data access (storage).

### Data Storage

- **Database**: PostgreSQL (via Drizzle ORM)
- **Schema**: Defined in the shared schema.ts file using Drizzle schema builders
- **Validation**: Zod for schema validation of input data

The database schema includes tables for users, memberships, categories, videos, and user downloads.

## Key Components

### Authentication System

- User registration and login with JWT tokens
- Role-based access control (user vs admin)
- Protected routes requiring authentication

### Video Management

- Video browsing with filters (category, resolution, premium status)
- Video previews (30-second clips for non-members)
- Video downloads for members based on their membership plan

### Membership System

- Tiered membership plans (Monthly, Quarterly, Annual)
- Download limits based on membership level
- Payment integration with Stripe

### Admin Dashboard

- User management (view, edit, delete)
- Video management (upload, edit, delete)
- Analytics dashboard with usage statistics

## Data Flow

1. **User Authentication Flow**:
   - User submits credentials -> Server validates -> JWT token generated -> Stored in HTTP-only cookie
   - Protected routes check for valid JWT token

2. **Video Browsing Flow**:
   - User requests videos -> Server applies filters -> Returns paginated results
   - Categories and featured videos displayed on homepage

3. **Purchase Flow**:
   - User selects membership -> Redirected to payment -> Payment processed -> Account updated with membership details
   - Download credits added to user account

4. **Download Flow**:
   - Authenticated user requests download -> Server checks membership status and download limits -> Streams video for download -> Updates download count

## External Dependencies

### Frontend Libraries

- **@radix-ui**: Low-level UI primitive components
- **@tanstack/react-query**: Data fetching and caching
- **@hookform/resolvers**: Form validation with Zod
- **date-fns**: Date formatting and manipulation
- **clsx and tailwind-merge**: Utility for conditional class names

### Backend Libraries

- **drizzle-orm**: TypeScript ORM for PostgreSQL
- **@neondatabase/serverless**: PostgreSQL client for serverless environments
- **jsonwebtoken**: For JWT token generation and validation
- **express**: Web server framework

### External Services

- **Stripe**: Payment processing integration
- **PostgreSQL**: Database service for storing application data

## Deployment Strategy

The application is configured for deployment on Replit with the following setup:

1. **Build Process**:
   - Vite for frontend build
   - ESBuild for backend compilation

2. **Environment Configuration**:
   - Environment variables for database connection, JWT secrets
   - Development/production mode detection

3. **Server Setup**:
   - Express.js server handling both API requests and serving the frontend
   - Vite middleware for development mode HMR

4. **Database Provisioning**:
   - Drizzle schema and migrations
   - PostgreSQL database to be configured in Replit

The application uses a unified deployment approach where the backend serves the frontend static files in production, while in development mode, it uses Vite's dev server with HMR.