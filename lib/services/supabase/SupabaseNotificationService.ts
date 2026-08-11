import { supabase } from '../../supabaseClient';
import type { Notification } from '../../types';
import type { INotificationService } from '../types';

export class SupabaseNotificationService implements INotificationService {
  async getAllForUser(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseNotificationService] Error fetching notifications:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      isRead: row.is_read,
      createdAt: row.created_at
    }));
  }

  async create(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.userId,
        title: notification.title,
        content: notification.content,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseNotificationService] Error creating notification: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      content: data.content,
      isRead: data.is_read,
      createdAt: data.created_at
    };
  }

  async markAsRead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error(`[SupabaseNotificationService] Error marking notification ${id} as read:`, error);
      return false;
    }
    return true;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) {
      console.error(`[SupabaseNotificationService] Error marking all notifications as read for user ${userId}:`, error);
      return false;
    }
    return true;
  }
}

