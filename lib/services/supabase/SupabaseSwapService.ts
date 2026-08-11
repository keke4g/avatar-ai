import { supabase } from '../../supabaseClient';
import type { SwapRequest, SwapStatus, SwapTravelDetails } from '../../types';
import type { ISwapService } from '../types';

export class SupabaseSwapService implements ISwapService {
  async getAll(): Promise<SwapRequest[]> {
    const { data, error } = await supabase
      .from('swaps')
      .select('*');

    if (error) {
      console.error('[SupabaseSwapService] Error fetching swaps:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderPropertyId: row.sender_property_id,
      receiverId: row.receiver_id,
      receiverPropertyId: row.receiver_property_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      message: row.message || '',
      createdAt: row.created_at,
      isDisputed: row.is_disputed,
      disputeReason: row.dispute_reason,
      senderConfirmedComplete: row.sender_confirmed_complete,
      receiverConfirmedComplete: row.receiver_confirmed_complete,
    }));
  }

  async getById(id: string): Promise<SwapRequest | null> {
    const { data, error } = await supabase
      .from('swaps')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[SupabaseSwapService] Error fetching swap request ${id}:`, error);
      return null;
    }

    return data ? {
      id: data.id,
      senderId: data.sender_id,
      senderPropertyId: data.sender_property_id,
      receiverId: data.receiver_id,
      receiverPropertyId: data.receiver_property_id,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      message: data.message || '',
      createdAt: data.created_at,
      isDisputed: data.is_disputed,
      disputeReason: data.dispute_reason,
      senderConfirmedComplete: data.sender_confirmed_complete,
      receiverConfirmedComplete: data.receiver_confirmed_complete,
    } : null;
  }

  async create(swap: Omit<SwapRequest, 'id' | 'createdAt' | 'status'>): Promise<SwapRequest> {
    const { data, error } = await supabase
      .from('swaps')
      .insert({
        sender_id: swap.senderId,
        sender_property_id: swap.senderPropertyId,
        receiver_id: swap.receiverId,
        receiver_property_id: swap.receiverPropertyId,
        start_date: swap.startDate,
        end_date: swap.endDate,
        status: 'PENDING',
        message: swap.message || ''
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseSwapService] Error creating swap request: ${error.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async updateStatus(id: string, status: SwapStatus): Promise<SwapRequest> {
    const { data, error } = await supabase
      .from('swaps')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseSwapService] Error updating swap status: ${error.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async confirmCompletion(id: string, userId: string): Promise<SwapRequest> {
    const swap = await this.getById(id);
    if (!swap) throw new Error('Swap request not found');

    const updateFields: any = {};
    if (swap.senderId === userId) {
      updateFields.sender_confirmed_complete = true;
    } else if (swap.receiverId === userId) {
      updateFields.receiver_confirmed_complete = true;
    } else {
      throw new Error('No estás autorizado para finalizar este intercambio.');
    }

    const { data: updatedData, error } = await supabase
      .from('swaps')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseSwapService] Error confirming completion: ${error.message}`);
    }

    // If both sender and receiver confirmed completion, transition state to COMPLETED
    if (updatedData.sender_confirmed_complete && updatedData.receiver_confirmed_complete) {
      return this.updateStatus(id, 'COMPLETED');
    }

    return this.getById(id) as Promise<SwapRequest>;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('swaps')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[SupabaseSwapService] Error deleting swap ${id}:`, error);
      return false;
    }
    return true;
  }

  async createDispute(swapId: string, reason: string): Promise<SwapRequest> {
    // 1. Insert row in disputes
    const { error: disputeErr } = await supabase
      .from('disputes')
      .insert({
        swap_id: swapId,
        reason,
        status: 'OPEN'
      });

    if (disputeErr) {
      throw new Error(`[SupabaseSwapService] Error creating dispute: ${disputeErr.message}`);
    }

    // 2. Update swaps table is_disputed flag
    const { data, error: swapErr } = await supabase
      .from('swaps')
      .update({ is_disputed: true })
      .eq('id', swapId)
      .select()
      .single();

    if (swapErr) {
      throw new Error(`[SupabaseSwapService] Error updating swap flag: ${swapErr.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async resolveDispute(swapId: string): Promise<SwapRequest> {
    // 1. Update dispute record to RESOLVED
    const { error: disputeErr } = await supabase
      .from('disputes')
      .update({ status: 'RESOLVED' })
      .eq('swap_id', swapId);

    if (disputeErr) {
      console.warn('[SupabaseSwapService] Dispute record resolve failed or not found:', disputeErr.message);
    }

    // 2. Update swaps table is_disputed flag
    const { data, error: swapErr } = await supabase
      .from('swaps')
      .update({ is_disputed: false })
      .eq('id', swapId)
      .select()
      .single();

    if (swapErr) {
      throw new Error(`[SupabaseSwapService] Error resolving swap flag: ${swapErr.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async getTravelDetails(swapId: string, travelerId: string): Promise<SwapTravelDetails | null> {
    const { data, error } = await supabase
      .from('swap_travel_details')
      .select('*')
      .eq('swap_id', swapId)
      .eq('traveler_id', travelerId)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseSwapService] Error fetching travel details for swap ${swapId}:`, error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      swapId: data.swap_id,
      travelerId: data.traveler_id,
      propertyId: data.property_id,
      wifiName: data.wifi_name || '',
      wifiPassword: data.wifi_password || '',
      accessCode: data.access_code || '',
      checkinInstructions: data.checkin_instructions || '',
      checkinTime: data.checkin_time || '15:00',
      checkoutTime: data.checkout_time || '11:00',
      emergencyContactName: data.emergency_contact_name || '',
      emergencyContactPhone: data.emergency_contact_phone || '',
      hostNotes: data.host_notes || '',
      createdAt: data.created_at
    };
  }

  async upsertTravelDetails(details: Partial<SwapTravelDetails> & { swapId: string; travelerId: string; propertyId: string }): Promise<SwapTravelDetails> {
    const payload = {
      swap_id: details.swapId,
      traveler_id: details.travelerId,
      property_id: details.propertyId,
      wifi_name: details.wifiName,
      wifi_password: details.wifiPassword,
      access_code: details.accessCode,
      checkin_instructions: details.checkinInstructions,
      checkin_time: details.checkinTime || '15:00',
      checkout_time: details.checkoutTime || '11:00',
      emergency_contact_name: details.emergencyContactName,
      emergency_contact_phone: details.emergencyContactPhone,
      host_notes: details.hostNotes
    };

    const { data, error } = await supabase
      .from('swap_travel_details')
      .upsert(payload, { onConflict: 'swap_id,traveler_id' })
      .select()
      .single();

    if (error) {
      console.error(`[SupabaseSwapService] Error upserting travel details:`, error);
      throw new Error(`[SupabaseSwapService] Error upserting travel details: ${error.message}`);
    }

    return {
      id: data.id,
      swapId: data.swap_id,
      travelerId: data.traveler_id,
      propertyId: data.property_id,
      wifiName: data.wifi_name || '',
      wifiPassword: data.wifi_password || '',
      accessCode: data.access_code || '',
      checkinInstructions: data.checkin_instructions || '',
      checkinTime: data.checkin_time || '15:00',
      checkoutTime: data.checkout_time || '11:00',
      emergencyContactName: data.emergency_contact_name || '',
      emergencyContactPhone: data.emergency_contact_phone || '',
      hostNotes: data.host_notes || '',
      createdAt: data.created_at
    };
  }

  async getAllTravelDetails(): Promise<SwapTravelDetails[]> {
    const { data, error } = await supabase
      .from('swap_travel_details')
      .select('*');

    if (error) {
      console.error('[SupabaseSwapService] Error fetching all travel details:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      swapId: row.swap_id,
      travelerId: row.traveler_id,
      propertyId: row.property_id,
      wifiName: row.wifi_name || '',
      wifiPassword: row.wifi_password || '',
      accessCode: row.access_code || '',
      checkinInstructions: row.checkin_instructions || '',
      checkinTime: row.checkin_time || '15:00',
      checkoutTime: row.checkout_time || '11:00',
      emergencyContactName: row.emergency_contact_name || '',
      emergencyContactPhone: row.emergency_contact_phone || '',
      hostNotes: row.host_notes || '',
      createdAt: row.created_at
    }));
  }
}

