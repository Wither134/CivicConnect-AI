import React from 'react';
import { useAuth } from '../../context/AuthContext.js';

export type UserRole = 'visitor' | 'citizen' | 'staff' | 'admin' | 'super_admin';

export interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  allowedRoles,
  fallback = null,
  requireAuth = false
}) => {
  const { user, isAuthenticated } = useAuth();
  const currentRole: UserRole = user ? (user.role as UserRole) : 'visitor';

  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

