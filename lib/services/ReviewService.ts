import { supabase } from '../supabaseClient';
import { Review } from '../types';
import { IReviewService } from './types';

// Map Postgres row to Review UI structure
const mapPostgresReview = (row: any): Review => ({
  id: row.id,
  swapId: row.swap_id,
  reviewerId: row.reviewer_id,
  reviewedUserId: row.reviewed_user_id,
  rating: Number(row.rating),
  comment: row.comment,
  createdAt: row.created_at,
});

export class InMemoryReviewService implements IReviewService {
  private getStorageReviews(): Review[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('auraswap_reviews');
    if (!stored) {
      // Seed initial dummy reviews to mimic high-fidelity platform reputation
      const dummy: Review[] = [
        {
          id: 'rev-1',
          swapId: 'swap-seed-1',
          reviewerId: 'user-carlos', // Carlos Mendoza
          reviewedUserId: 'user-sofia',  // Sofia Alvarez (Host of prop-1 Cancun)
          rating: 5,
          comment: 'Excelente anfitriona. Su villa en Cancún es un paraíso absoluto. Impecable comunicación y gran cuidado de mi Loft.',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'rev-2',
          swapId: 'swap-seed-2',
          reviewerId: 'user-sofia',  // Sofia Alvarez
          reviewedUserId: 'user-mateo',  // Mateo Valenzuela
          rating: 5,
          comment: 'Mateo cuidó de mi propiedad de forma extraordinaria. Es un host educado, detallista y con excelente comunicación.',
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      localStorage.setItem('auraswap_reviews', JSON.stringify(dummy));
      return dummy;
    }
    return JSON.parse(stored);
  }

  private setStorageReviews(reviews: Review[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('auraswap_reviews', JSON.stringify(reviews));
  }

  async getAll(): Promise<Review[]> {
    return this.getStorageReviews();
  }

  async create(review: Omit<Review, 'id' | 'createdAt'>): Promise<Review> {
    const list = this.getStorageReviews();
    
    // Check constraint unique_reviewer_swap
    if (list.some(r => r.swapId === review.swapId && r.reviewerId === review.reviewerId)) {
      throw new Error('Ya has escrito una reseña para este intercambio.');
    }

    const newReview: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    list.unshift(newReview);
    this.setStorageReviews(list);
    return newReview;
  }

  async getReviewsForUser(userId: string): Promise<Review[]> {
    return this.getStorageReviews().filter(r => r.reviewedUserId === userId);
  }

  async getReviewsBySwap(swapId: string): Promise<Review[]> {
    return this.getStorageReviews().filter(r => r.swapId === swapId);
  }

  async delete(id: string): Promise<void> {
    const list = this.getStorageReviews().filter(r => r.id !== id);
    this.setStorageReviews(list);
  }
}

export class SupabaseReviewService implements IReviewService {
  async getAll(): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('id,swap_id,reviewer_id,reviewed_user_id,rating,comment,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseReviewService] getAll failed:', error);
      throw error;
    }

    return (data || []).map(mapPostgresReview);
  }

  async create(review: Omit<Review, 'id' | 'createdAt'>): Promise<Review> {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        swap_id: review.swapId,
        reviewer_id: review.reviewerId,
        reviewed_user_id: review.reviewedUserId,
        rating: review.rating,
        comment: review.comment,
      })
      .select('id,swap_id,reviewer_id,reviewed_user_id,rating,comment,created_at')
      .single();

    if (error) {
      console.error('[SupabaseReviewService] create failed:', error);
      throw error;
    }

    return mapPostgresReview(data);
  }

  async getReviewsForUser(userId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('id,swap_id,reviewer_id,reviewed_user_id,rating,comment,created_at')
      .eq('reviewed_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseReviewService] getReviewsForUser failed:', error);
      throw error;
    }

    return (data || []).map(mapPostgresReview);
  }

  async getReviewsBySwap(swapId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('id,swap_id,reviewer_id,reviewed_user_id,rating,comment,created_at')
      .eq('swap_id', swapId);

    if (error) {
      console.error('[SupabaseReviewService] getReviewsBySwap failed:', error);
      throw error;
    }

    return (data || []).map(mapPostgresReview);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseReviewService] delete failed:', error);
      throw error;
    }
  }
}
