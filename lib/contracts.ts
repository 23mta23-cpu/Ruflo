import { supabase } from './supabase';
import type { Contract, Job, Offer } from './database.types';

// ── Types ─────────────────────────────────────────────────────

export type ContractWithJob = Contract & {
  job: Pick<Job, 'id' | 'title' | 'category' | 'address_city' | 'address_plz' | 'status'>;
};

export type ContractWithOffer = Contract & {
  offer: Pick<Offer, 'id' | 'price' | 'description' | 'duration_hours'>;
};

export type ContractWithJobAndCustomer = Contract & {
  job: Pick<Job, 'id' | 'title' | 'category' | 'address_city' | 'address_plz' | 'status'>;
  customer: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
};

// ── Queries ───────────────────────────────────────────────────

export async function getMyContractsAsProvider(providerId: string): Promise<ContractWithJobAndCustomer[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, job:jobs(id, title, category, address_city, address_plz, status), customer:profiles!customer_id(display_name, first_name, last_name)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContractWithJobAndCustomer[];
}

export async function getMyContractsAsCustomer(customerId: string): Promise<ContractWithJob[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, job:jobs(id, title, category, address_city, address_plz, status)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContractWithJob[];
}

export async function getContractById(contractId: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (error) throw error;
  return data;
}

export async function completeContract(contractId: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', contractId);

  if (error) throw error;
}

export async function cancelContract(contractId: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', contractId);

  if (error) throw error;
}

// ── Formatters ────────────────────────────────────────────────

export function contractStatusLabel(status: Contract['status']): string {
  const map: Record<Contract['status'], string> = {
    pending:   'Ausstehend',
    active:    'Aktiv',
    completed: 'Abgeschlossen',
    disputed:  'Streitig',
    cancelled: 'Storniert',
  };
  return map[status] ?? status;
}

export function contractStatusVariant(status: Contract['status']): 'green' | 'amber' | 'red' | 'muted' {
  const map: Record<Contract['status'], 'green' | 'amber' | 'red' | 'muted'> = {
    pending:   'amber',
    active:    'green',
    completed: 'muted',
    disputed:  'red',
    cancelled: 'red',
  };
  return map[status] ?? 'muted';
}
