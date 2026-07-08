import { supabase } from '../supabaseClient';
import { PropertyMedia } from '../types';
import { PropertyMediaMapper } from './PropertyMediaMapper';

export class SupabasePropertyMediaService {
  /**
   * Fetch all active media items for a given property.
   */
  async getByProperty(propertyId: string): Promise<PropertyMedia[]> {
    const { data, error } = await supabase
      .from('property_media')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) {
      console.error(`[PropertyMediaService] Error fetching media for property ${propertyId}:`, error);
      return [];
    }

    return (data || []).map(row => PropertyMediaMapper.mapPostgresToClient(row));
  }

  /**
   * Synchronize all media items for a property in batch.
   * Inserts new items, updates modified existing items, and soft-deletes removed items.
   */
  async saveBatch(propertyId: string, mediaItems: Partial<PropertyMedia>[]): Promise<void> {
    console.log(`[PropertyMediaService] Sincronizando batch de multimedia para propiedad: ${propertyId}. Items recibidos:`, mediaItems.length);

    // 1. Fetch current active media from Supabase
    const { data: dbItems, error: fetchError } = await supabase
      .from('property_media')
      .select('id')
      .eq('property_id', propertyId)
      .is('deleted_at', null);

    if (fetchError) {
      console.error('[PropertyMediaService] Error fetching current media for sync:', fetchError);
      throw fetchError;
    }

    const existingDbIds = new Set((dbItems || []).map(item => item.id));
    const incomingIds = new Set(mediaItems.filter(item => item.id).map(item => item.id!));

    // 2. Identify items to soft-delete (exist in DB but not in incoming payload)
    const idsToSoftDelete = [...existingDbIds].filter(id => !incomingIds.has(id));

    if (idsToSoftDelete.length > 0) {
      console.log(`[PropertyMediaService] Soft-deleting ${idsToSoftDelete.length} removed media items.`);
      const { error: deleteError } = await supabase
        .from('property_media')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', idsToSoftDelete);

      if (deleteError) {
        console.error('[PropertyMediaService] Error soft-deleting media items:', deleteError);
        throw deleteError;
      }
    }

    // 3. Separate incoming items into inserts and updates
    const inserts: any[] = [];
    const updates: any[] = [];

    mediaItems.forEach((item, index) => {
      // Ensure property_id and order are set correctly
      const dbRow = PropertyMediaMapper.mapClientToPostgres({
        ...item,
        propertyId,
        displayOrder: item.displayOrder !== undefined ? item.displayOrder : index,
      });

      if (item.id && existingDbIds.has(item.id)) {
        updates.push(dbRow);
      } else {
        // If it's a new item, remove any dummy/temporary ID so DB generates uuid
        if (!item.id || item.id.startsWith('temp-')) {
          delete dbRow.id;
        }
        inserts.push(dbRow);
      }
    });

    // 4. Execute inserts in batch
    if (inserts.length > 0) {
      console.log(`[PropertyMediaService] Inserting ${inserts.length} new media items.`);
      const { error: insertError } = await supabase
        .from('property_media')
        .insert(inserts);

      if (insertError) {
        console.error('[PropertyMediaService] Error inserting new media items:', insertError);
        throw insertError;
      }
    }

    // 5. Execute updates (PostgREST does not support batch multi-row updates with different values, so we update individually)
    if (updates.length > 0) {
      console.log(`[PropertyMediaService] Updating ${updates.length} existing media items.`);
      for (const updateRow of updates) {
        const { error: updateError } = await supabase
          .from('property_media')
          .update(updateRow)
          .eq('id', updateRow.id);

        if (updateError) {
          console.error(`[PropertyMediaService] Error updating media item ${updateRow.id}:`, updateError);
          throw updateError;
        }
      }
    }

    console.log('[PropertyMediaService] ✔ Sincronización de multimedia completada con éxito.');
  }

  /**
   * Reorder media items based on an array of IDs.
   */
  async reorder(mediaIds: string[]): Promise<void> {
    console.log('[PropertyMediaService] Reordenando items:', mediaIds);
    for (let idx = 0; idx < mediaIds.length; idx++) {
      const { error } = await supabase
        .from('property_media')
        .update({ display_order: idx })
        .eq('id', mediaIds[idx]);

      if (error) {
        console.error(`[PropertyMediaService] Error reordering media item ${mediaIds[idx]}:`, error);
        throw error;
      }
    }
  }

  /**
   * Set a specific media item as the primary resource.
   */
  async setPrimary(mediaId: string): Promise<void> {
    // Find the property_id of this media item first
    const { data, error: findError } = await supabase
      .from('property_media')
      .select('property_id')
      .eq('id', mediaId)
      .single();

    if (findError || !data) {
      console.error('[PropertyMediaService] Error finding property for primary media:', findError);
      return;
    }

    const propertyId = data.property_id;

    // Reset all other media elements of this property to false
    const { error: resetError } = await supabase
      .from('property_media')
      .update({ is_primary: false })
      .eq('property_id', propertyId);

    if (resetError) {
      console.error('[PropertyMediaService] Error resetting primary flag:', resetError);
      throw resetError;
    }

    // Set target media element to true
    const { error: setError } = await supabase
      .from('property_media')
      .update({ is_primary: true })
      .eq('id', mediaId);

    if (setError) {
      console.error('[PropertyMediaService] Error setting primary flag on media:', setError);
      throw setError;
    }
  }
}
