import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const onAuthStateChanged = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: any, operationType: OperationType, table: string | null) {
  console.error(`Supabase Error [${operationType}] on table [${table}]:`, error);
  throw new Error(error.message || String(error));
}

export async function logAudit(userId: string, userName: string, action: string, entityType: string, entityId: string, details?: string) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || '',
      timestamp: new Date().toISOString()
    });
    if (error) throw error;
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
}
