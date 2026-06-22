export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole       = 'customer' | 'provider';
export type KycStatus      = 'pending' | 'approved' | 'rejected';
export type JobStatus      = 'open' | 'matched' | 'contracted' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type OfferStatus    = 'pending' | 'accepted' | 'declined' | 'expired';
export type ContractStatus = 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled';
export type SenderRole     = 'customer' | 'provider';
export type FeeTrackDB     = 'handwerker' | 'nachbarschaft';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          phone: string | null;
          email: string;
          avatar_url: string | null;
          plz: string | null;
          city: string | null;
          pstg_tx_count: number;
          pstg_revenue: number;
          pstg_locked: boolean;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          full_name: string;
          phone?: string | null;
          email: string;
          avatar_url?: string | null;
          plz?: string | null;
          city?: string | null;
          pstg_tx_count?: number;
          pstg_revenue?: number;
          pstg_locked?: boolean;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };

      provider_profiles: {
        Row: {
          id: string;
          business_name: string | null;
          trade_id: string | null;
          is_nachbarschaft: boolean;
          stripe_account_id: string | null;
          stripe_onboarded: boolean;
          kyc_status: KycStatus;
          steuer_id: string | null;
          meister_verified: boolean;
          is_pro: boolean;
          pro_expires_at: string | null;
          rating_avg: number;
          rating_count: number;
          strike_count: number;
          available: boolean;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          business_name?: string | null;
          trade_id?: string | null;
          is_nachbarschaft?: boolean;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          kyc_status?: KycStatus;
          steuer_id?: string | null;
          meister_verified?: boolean;
          is_pro?: boolean;
          pro_expires_at?: string | null;
          rating_avg?: number;
          rating_count?: number;
          strike_count?: number;
          available?: boolean;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['provider_profiles']['Insert']>;
        Relationships: [];
      };

      jobs: {
        Row: {
          id: string;
          customer_id: string;
          provider_id: string | null;
          title: string;
          description: string;
          category: string;
          track: FeeTrackDB;
          address_plz: string;
          address_city: string;
          address_street: string | null;
          price_gross: number | null;
          status: JobStatus;
          scheduled_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          provider_id?: string | null;
          title: string;
          description: string;
          category: string;
          track?: FeeTrackDB;
          address_plz: string;
          address_city: string;
          address_street?: string | null;
          price_gross?: number | null;
          status?: JobStatus;
          scheduled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
        Relationships: [];
      };

      offers: {
        Row: {
          id: string;
          job_id: string;
          provider_id: string;
          price: number;
          description: string | null;
          duration_hours: number | null;
          scheduled_at: string | null;
          status: OfferStatus;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          provider_id: string;
          price: number;
          description?: string | null;
          duration_hours?: number | null;
          scheduled_at?: string | null;
          status?: OfferStatus;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database['public']['Tables']['offers']['Insert']>;
        Relationships: [];
      };

      contracts: {
        Row: {
          id: string;
          job_id: string;
          offer_id: string;
          customer_id: string;
          provider_id: string;
          customer_signed_at: string | null;
          provider_signed_at: string | null;
          stripe_payment_intent: string | null;
          escrow_captured_at: string | null;
          escrow_released_at: string | null;
          price_gross: number;
          werkr_schutz_fee: number;
          customer_service_fee: number;
          provider_commission: number;
          customer_total: number;
          provider_payout: number;
          track: FeeTrackDB;
          status: ContractStatus;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          offer_id: string;
          customer_id: string;
          provider_id: string;
          customer_signed_at?: string | null;
          provider_signed_at?: string | null;
          stripe_payment_intent?: string | null;
          escrow_captured_at?: string | null;
          escrow_released_at?: string | null;
          price_gross: number;
          werkr_schutz_fee: number;
          customer_service_fee: number;
          provider_commission: number;
          customer_total: number;
          provider_payout: number;
          track: FeeTrackDB;
          status?: ContractStatus;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>;
        Relationships: [];
      };

      messages: {
        Row: {
          id: string;
          job_id: string;
          sender_id: string;
          sender_role: SenderRole;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          sender_id: string;
          sender_role: SenderRole;
          body: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };

      reviews: {
        Row: {
          id: string;
          contract_id: string;
          reviewer_id: string;
          reviewed_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          reviewer_id: string;
          reviewed_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };

      disputes: {
        Row: {
          id: string;
          contract_id: string;
          reporter_id: string;
          case_id: string;
          category: 'quality' | 'noshow' | 'price' | 'damage' | 'communication' | 'other';
          description: string;
          status: 'open' | 'provider_response_pending' | 'under_review' | 'resolved';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          reporter_id: string;
          case_id: string;
          category: 'quality' | 'noshow' | 'price' | 'damage' | 'communication' | 'other';
          description: string;
          status?: 'open' | 'provider_response_pending' | 'under_review' | 'resolved';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['disputes']['Insert']>;
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      accept_offer: {
        Args: {
          p_offer_id: string;
          p_job_id: string;
          p_customer_id: string;
        };
        Returns: string;
      };
    };

    Enums: {
      user_role: UserRole;
      kyc_status: KycStatus;
      job_status: JobStatus;
      offer_status: OfferStatus;
      contract_status: ContractStatus;
      sender_role: SenderRole;
      fee_track: FeeTrackDB;
    };

    CompositeTypes: Record<string, never>;
  };
};

// ── Convenience row types ──────────────────────────────────────

export type Profile         = Database['public']['Tables']['profiles']['Row'];
export type ProviderProfile = Database['public']['Tables']['provider_profiles']['Row'];
export type Job             = Database['public']['Tables']['jobs']['Row'];
export type Offer           = Database['public']['Tables']['offers']['Row'];
export type Contract        = Database['public']['Tables']['contracts']['Row'];
export type Message         = Database['public']['Tables']['messages']['Row'];
export type Review          = Database['public']['Tables']['reviews']['Row'];

// ── Joined / enriched types ────────────────────────────────────

export type ProviderWithProfile = ProviderProfile & {
  profile: Profile;
};

export type JobWithParties = Job & {
  customer: Profile;
  provider: ProviderWithProfile | null;
};

export type OfferWithProvider = Offer & {
  provider: ProviderWithProfile;
};

export type ContractWithParties = Contract & {
  customer: Profile;
  provider: ProviderWithProfile;
  job: Job;
  offer: Offer;
};

export type MessageWithSender = Message & {
  sender: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>;
};
