import { supabase } from '../../supabaseClient';
import type { ChatMessage } from '../../types';
import type { IMessageService } from '../types';

export class SupabaseMessageService implements IMessageService {
  async getAllForUser(_userId: string): Promise<ChatMessage[]> {
    // Fetch all messages. RLS guarantees only matching messages are returned
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(name)');

    if (error) {
      console.error('[SupabaseMessageService] Error fetching messages:', error);
      return [];
    }

    return (data || []).map(row => {
      const senderProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        swapRequestId: row.swap_id,
        senderId: row.sender_id || 'system',
        senderName: row.sender_id ? (senderProfile?.name || 'Host') : 'Towers México',
        content: row.content,
        createdAt: row.created_at,
        isRead: row.is_read ?? false
      };
    });
  }

  async send(swapRequestId: string, content: string, senderId: string): Promise<ChatMessage> {
    const isSystem = senderId === 'system';
    // 1. Insert message row into messages
    const { data, error } = await supabase
      .from('messages')
      .insert({
        swap_id: swapRequestId,
        sender_id: isSystem ? null : senderId,
        content,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseMessageService] Error sending message: ${error.message}`);
    }

    // 2. Fetch profiles join to map back senderName
    let senderName = 'Towers México';
    if (!isSystem) {
      const { data: profile } = await supabase
        .from('public_profiles_view')
        .select('name')
        .eq('id', senderId)
        .single();
      senderName = profile?.name || 'Host';
    }

    return {
      id: data.id,
      swapRequestId: data.swap_id,
      senderId: data.sender_id || 'system',
      senderName,
      content: data.content,
      createdAt: data.created_at,
      isRead: data.is_read ?? false
    };
  }

  async markAsRead(swapRequestId: string, userId: string): Promise<void> {
    // Mark all messages as read for this swap thread where the sender is NOT the active user
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('swap_id', swapRequestId)
      .neq('sender_id', userId);

    if (error) {
      console.error(`[SupabaseMessageService] Error marking messages as read for swap ${swapRequestId}:`, error.message);
    }
  }
}
