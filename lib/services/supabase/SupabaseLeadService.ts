import { supabase } from '../../supabaseClient';
import type { Lead } from '../../types';
import type { ILeadService } from '../types';

export class SupabaseLeadService implements ILeadService {
  async getAllForUser(_userId: string): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseLeadService] Error fetching leads:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      propertyId: row.property_id,
      offeringId: row.offering_id,
      userId: row.user_id,
      leadType: row.lead_type,
      message: row.message || '',
      status: row.status || 'NEW',
      createdAt: row.created_at,
    }));
  }

  async create(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        property_id: lead.propertyId,
        offering_id: lead.offeringId,
        user_id: lead.userId,
        lead_type: lead.leadType,
        message: lead.message,
        status: 'NEW',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseLeadService] Error creating lead: ${error.message}`);
    }

    return {
      id: data.id,
      propertyId: data.property_id,
      offeringId: data.offering_id,
      userId: data.user_id,
      leadType: data.lead_type,
      message: data.message || '',
      status: data.status || 'NEW',
      createdAt: data.created_at,
    };
  }
}
