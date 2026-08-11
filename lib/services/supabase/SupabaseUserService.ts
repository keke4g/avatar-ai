import { supabase } from '../../supabaseClient';
import type { User } from '../../types';
import type { IUserService } from '../types';

export class SupabaseUserService implements IUserService {
  async getAll(): Promise<User[]> {
    console.log('[SupabaseUserService] Querying public_profiles_view.getAll()...');
    const { data, error } = await supabase
      .from('public_profiles_view')
      .select('*');

    if (error) {
      console.error('[SupabaseUserService] Error fetching profiles. Code:', error.code, 'Message:', error.message, 'Full Error:', error);
      return [];
    }

    console.log('[SupabaseUserService] Query public_profiles_view.getAll() success. Row count:', data?.length, 'Exact Data Result:', data);
    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar_url || '',
      role: row.role,
      isVerified: row.is_verified === true,
      kycStatus: row.kyc_status,
      joinDate: row.created_at?.split('T')[0],
      swapsCount: 0,
      isSuspended: false,
      favorites: [],
      companyId: row.company_id,
      officeId: row.office_id,
      profileType: row.profile_type
    }));
  }

  async getById(id: string): Promise<User | null> {
    console.log(`[SupabaseUserService] Querying profile.getById(${id})...`);
    
    // Dynamically query profiles table for self to see email, or public_profiles_view for others
    const currentUser = (await supabase.auth.getUser()).data.user;
    const isSelf = currentUser?.id === id;
    const targetSource = isSelf ? 'profiles' : 'public_profiles_view';

    const { data, error } = await supabase
      .from(targetSource)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[SupabaseUserService] Error fetching profile ${id} from ${targetSource}. Code:`, error.code, 'Message:', error.message, 'Full Error:', error);
      return null;
    }

    console.log(`[SupabaseUserService] Query profile.getById(${id}) from ${targetSource} success. Exact Data Result:`, data);


    return data ? {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar_url || '',
      role: data.role,
      isVerified: data.is_verified === true,
      kycStatus: data.kyc_status,
      joinDate: data.created_at?.split('T')[0],
      swapsCount: 0,
      isSuspended: false,
      favorites: [],
      bio: data.bio || '',
      location: data.location || '',
      companyId: data.company_id,
      officeId: data.office_id,
      profileType: data.profile_type
    } : null;
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const payload: any = {};
    const hasEditableSettings = userData.name !== undefined
      || userData.avatar !== undefined
      || userData.bio !== undefined
      || userData.location !== undefined;

    if (hasEditableSettings) {
      const { error: settingsError } = await supabase.rpc('update_profile_settings', {
        target_user_id: id,
        target_name: userData.name,
        target_avatar_url: userData.avatar,
        target_bio: userData.bio,
        target_location: userData.location,
      });

      if (settingsError) {
        throw new Error(`[SupabaseUserService] Error updating profile settings: ${settingsError.message}`);
      }
    }

    if (userData.role !== undefined) payload.role = userData.role;
    if (userData.kycStatus !== undefined) {
      payload.kyc_status = userData.kycStatus;
      payload.is_verified = userData.kycStatus === 'VERIFIED';
    }
    if (userData.isVerified !== undefined) payload.is_verified = userData.isVerified;
    if (userData.companyId !== undefined) payload.company_id = userData.companyId;
    if (userData.officeId !== undefined) payload.office_id = userData.officeId;
    if (userData.profileType !== undefined) payload.profile_type = userData.profileType;

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', id);

      if (error) {
        throw new Error(`[SupabaseUserService] Error updating profile ${id}: ${error.message}`);
      }
    }

    const updatedUser = await this.getById(id);
    if (!updatedUser) {
      throw new Error(`[SupabaseUserService] Updated profile ${id} could not be reloaded.`);
    }
    return updatedUser;
  }

  async updateVerification(id: string, isVerified: boolean, kycStatus: 'VERIFIED' | 'FAILED' | 'PENDING'): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_verified: isVerified, kyc_status: kycStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseUserService] Error updating profile verification: ${error.message}`);
    }

    return this.getById(data.id) as Promise<User>;
  }
}

