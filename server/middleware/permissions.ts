import { Request, Response, NextFunction } from 'express';
import { userRoles, type UserRole } from '@shared/schema';

/**
 * Permission middleware that enforces role-based access control
 * Allows restricting routes to specific user roles
 */
export function hasRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'You must be logged in to access this resource' });
    }

    const userRole = req.user.role as UserRole;

    // Admin role has access to everything
    if (userRole === userRoles.ADMIN) {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'You do not have permission to access this resource',
      requiredRoles: allowedRoles
    });
  };
}

/**
 * More granular permission checking that can be used within controllers
 * to restrict specific actions
 */
export function checkPermission(user: any, action: string, resource: string): boolean {
  if (!user) return false;
  
  const userRole = user.role as UserRole;
  
  // Admin can do everything
  if (userRole === userRoles.ADMIN) {
    return true;
  }
  
  // Role-based permissions map
  const rolePermissions: Record<UserRole, string[]> = {
    [userRoles.ADMIN]: ['*'], // Admin can do everything
    [userRoles.USER]: [
      'read:video',
      'download:video',
      'create:playlist',
      'update:playlist',
      'delete:playlist',
      'read:profile',
      'update:profile'
    ],
    [userRoles.UPLOADER]: [
      'read:video',
      'download:video',
      'create:video',
      'update:video',
      'delete:video',
      'upload:video',
      'read:profile',
      'update:profile'
    ],
    [userRoles.REVIEWER]: [
      'read:video',
      'download:video',
      'update:video', // Can update but not create/delete
      'approve:video',
      'reject:video',
      'read:profile',
      'update:profile'
    ],
    [userRoles.PROMOTER]: [
      'read:video',
      'download:video',
      'feature:video',
      'create:promotion',
      'create:release',
      'update:release',
      'read:profile',
      'update:profile'
    ],
    [userRoles.ANALYTICS]: [
      'read:video',
      'read:analytics',
      'read:reports',
      'export:data',
      'read:profile',
      'update:profile'
    ],
    [userRoles.MODERATOR]: [
      'read:video',
      'download:video',
      'update:video',
      'moderate:video',
      'moderate:comment',
      'moderate:user',
      'read:profile',
      'update:profile'
    ]
  };
  
  // Check if user has the specific permission
  const userPermissions = rolePermissions[userRole] || [];
  const permissionString = `${action}:${resource}`;
  
  return userPermissions.includes('*') || userPermissions.includes(permissionString);
}

/**
 * API Key authentication middleware for 3rd party integrations
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }
  
  // In a real implementation, you would validate this against the apiKeys table
  // For now, we'll just simulate the check
  // TODO: Implement actual database check
  setTimeout(() => {
    // Attach the API information to the request
    (req as any).apiKey = {
      id: 1,
      userId: 1,
      permissions: ['read:video', 'download:video']
    };
    
    // Log API usage
    setTimeout(() => {
      console.log(`API Usage: ${req.method} ${req.path}`);
      // In a real implementation, we would log this to the database
    }, 0);
    
    next();
  }, 50);
}

/**
 * Check if the API key has the required permissions
 */
export function hasApiPermission(requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = (req as any).apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }
    
    // Check if the API key has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      apiKey.permissions.includes(permission) || apiKey.permissions.includes('*')
    );
    
    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: 'API key does not have the required permissions',
        requiredPermissions
      });
    }
    
    next();
  };
}