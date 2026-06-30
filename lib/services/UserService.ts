import { User, UserRole } from '../types';

export const UserService = {
  updateRole(users: User[], userId: string, role: UserRole): User[] {
    return users.map((u) => (u.id === userId ? { ...u, role } : u));
  },

  toggleSuspension(users: User[], userId: string): User[] {
    return users.map((u) => (u.id === userId ? { ...u, isSuspended: !u.isSuspended } : u));
  },

  verifyKyc(users: User[], userId: string, kycStatus: 'PENDING' | 'VERIFIED' | 'FAILED'): User[] {
    return users.map((u) => (u.id === userId ? { ...u, kycStatus, isVerified: kycStatus === 'VERIFIED' } : u));
  },

  toggleHostVerified(users: User[], userId: string): User[] {
    return users.map((u) => {
      if (u.id === userId) {
        const nextVerified = !u.isVerified;
        return { ...u, isVerified: nextVerified, kycStatus: nextVerified ? 'VERIFIED' as const : u.kycStatus };
      }
      return u;
    });
  }
};
