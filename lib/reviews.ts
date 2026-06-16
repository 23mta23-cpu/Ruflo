import { supabase } from './supabase';

export async function createReview(params: {
  contractId: string;
  reviewedId: string;
  reviewerId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    contract_id: params.contractId,
    reviewed_id: params.reviewedId,
    reviewer_id: params.reviewerId,
    rating: params.rating,
    comment: params.comment ?? null,
  });
  if (error) throw error;
}
