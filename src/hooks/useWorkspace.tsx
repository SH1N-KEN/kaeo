import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';
import { useToast } from './useToast';

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface Client {
  id: string;
  name: string;
  organization_id: string;
  industry?: string;
  base_currency?: string;
  metadata?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  account_mode: 'business_owner' | 'accountant' | null;
  onboarding_completed: boolean;
  onboarding_answers: any;
  default_organization_id: string | null;
}

interface WorkspaceContextType {
  organizations: Organization[];
  clients: Client[];
  activeOrg: Organization | null;
  activeClient: Client | null;
  profile: UserProfile | null;
  onboardingCompleted: boolean;
  accountMode: 'business_owner' | 'accountant' | null;
  loading: boolean;
  error: string | null;
  setActiveOrg: (org: Organization | null) => void;
  setActiveClient: (client: Client | null) => void;
  createOrganization: (name: string, type?: string) => Promise<Organization | null>;
  createClient: (name: string, orgId: string, industry?: string, currency?: string, metadata?: any) => Promise<Client | null>;
  completeOnboarding: (
    mode: 'business_owner' | 'accountant',
    answers: any,
    orgName: string,
    clientName?: string,
    clientMetadata?: any
  ) => Promise<void>;
  updateClientMetadata: (clientId: string, metadata: any) => Promise<void>;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  modalMode: 'create_business' | 'edit_business' | 'create_client_business' | 'edit_client_business' | null;
  setModalMode: (mode: 'create_business' | 'edit_business' | 'create_client_business' | 'edit_client_business' | null) => void;
  clientToEdit: any | null;
  setClientToEdit: (client: any | null) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);
  const [activeClient, setActiveClientState] = useState<Client | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create_business' | 'edit_business' | 'create_client_business' | 'edit_client_business' | null>(null);
  const [clientToEdit, setClientToEdit] = useState<any | null>(null);

  const fetchWorkspaces = useCallback(async (isRefresh = false) => {
    if (!user) {
      console.log('useWorkspace: No user found, skipping fetch');
      return;
    }
    
    if (!isRefresh) setLoading(true);
    setError(null);

    console.log('useWorkspace: Fetching workspaces for user:', user.id);

    try {
      // 1. Fetch/Initialize Profile
      let profileData: UserProfile | null = null;
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // Check if user already has organizations to infer onboarding completion status
      const { data: orgsCheck } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      const hasOrgs = orgsCheck && orgsCheck.length > 0;

      if (profError) {
        console.error('useWorkspace: Error fetching profile:', profError);
      } else if (prof) {
        profileData = prof as UserProfile;
        
        // Infer onboarding completed if user already has organizations but database flags are false
        if (!prof.onboarding_completed && hasOrgs) {
          console.log('useWorkspace: Inferring onboarding completed for existing organization user');
          const { data: updatedProf } = await supabase
            .from('profiles')
            .update({
              onboarding_completed: true,
              account_mode: prof.account_mode || 'business_owner'
            })
            .eq('id', user.id)
            .select()
            .maybeSingle();
            
          if (updatedProf) {
            profileData = updatedProf as UserProfile;
          }
        }
      } else {
        // Create profile if missing
        const { data: newProf, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            avatar_url: user.user_metadata?.avatar_url || '',
            onboarding_completed: hasOrgs,
            account_mode: hasOrgs ? 'business_owner' : null
          })
          .select()
          .maybeSingle();
        
        if (insertError) {
          console.error('useWorkspace: Error inserting missing profile:', insertError);
        } else if (newProf) {
          profileData = newProf as UserProfile;
        }
      }
      setProfile(profileData);

      // 2. Fetch Organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) {
        console.error('useWorkspace: Error fetching organizations:', orgsError);
        throw orgsError;
      }
      
      console.log('useWorkspace: Organizations found:', orgs?.length || 0);
      setOrganizations(orgs || []);

      // 3. Migrate & load stored selection or pick first
      const newOrgKey = `kaeo:${user.id}:activeOrganizationId`;
      const newClientKey = `kaeo:${user.id}:activeClientId`;
      const oldOrgKey = `kaeo_org_${user.id}`;
      const oldClientKey = `kaeo_client_${user.id}`;

      if (localStorage.getItem(oldOrgKey) && !localStorage.getItem(newOrgKey)) {
        localStorage.setItem(newOrgKey, localStorage.getItem(oldOrgKey)!);
      }
      if (localStorage.getItem(oldClientKey) && !localStorage.getItem(newClientKey)) {
        localStorage.setItem(newClientKey, localStorage.getItem(oldClientKey)!);
      }

      const storedOrgId = localStorage.getItem(newOrgKey);
      const storedClientId = localStorage.getItem(newClientKey);

      // Check all accessible clients to search specifically for "type shi"
      const { data: allUserCls } = await supabase
        .from('clients')
        .select('*');

      console.log('=== DEV DIAGNOSTICS ===');
      console.log('User ID:', user.id);
      console.log('Organizations:', orgs);
      console.log('All visible clients:', allUserCls);
      console.log('localStorage keys:', {
        oldOrg: localStorage.getItem(oldOrgKey),
        oldClient: localStorage.getItem(oldClientKey),
        newOrg: localStorage.getItem(newOrgKey),
        newClient: localStorage.getItem(newClientKey),
      });

      const typeShiClient = (allUserCls || []).find(c => 
        (c.name?.toLowerCase().includes('type shi') || 
        c.metadata?.business_name?.toLowerCase().includes('type shi')) &&
        c.status?.toLowerCase() !== 'archived' &&
        c.status?.toLowerCase() !== 'deleted'
      );
      if (typeShiClient) {
        console.log('Found "type shi" client in DB:', typeShiClient);
      } else {
        console.log('"type shi" client NOT found in DB.');
      }
      console.log('========================');

      if (orgs && orgs.length > 0) {
        let foundOrg = orgs.find(o => o.id === storedOrgId) || orgs[0];

        // 4. Fetch Clients for resolved org
        const { data: cls, error: clsError } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', foundOrg.id)
          .order('name');

        if (clsError) {
          console.error('useWorkspace: Error fetching clients:', clsError);
          throw clsError;
        }

        // Active clients are those not explicitly archived or deleted
        const activeCls = (cls || []).filter(c => {
          const status = c.status?.toLowerCase();
          return status !== 'archived' && status !== 'deleted';
        });
        
        console.log('useWorkspace: Active clients found for org:', activeCls?.length || 0);
        setClients(activeCls);

        let resolvedClient = activeCls.find(c => c.id === storedClientId);

        // Auto-recovery / Select "type shi" if no valid client selection is stored and it exists
        if (!resolvedClient && typeShiClient) {
          const correspondingOrg = orgs.find(o => o.id === typeShiClient.organization_id);
          if (correspondingOrg) {
            foundOrg = correspondingOrg;
            
            // Re-fetch clients for type shi's org
            const { data: tsCls } = await supabase
              .from('clients')
              .select('*')
              .eq('organization_id', foundOrg.id)
              .order('name');
            
            const activeTsCls = (tsCls || []).filter(c => {
              const status = c.status?.toLowerCase();
              return status !== 'archived' && status !== 'deleted';
            });
            setClients(activeTsCls);
            resolvedClient = activeTsCls.find(c => c.id === typeShiClient.id) || typeShiClient;
          }
        }

        // If no active client selected but activeCls exists, select the first one
        if (!resolvedClient && activeCls.length > 0) {
          resolvedClient = activeCls[0];
        }

        setActiveOrgState(foundOrg);
        localStorage.setItem(newOrgKey, foundOrg.id);

        if (resolvedClient) {
          setActiveClientState(resolvedClient);
          localStorage.setItem(newClientKey, resolvedClient.id);
          console.log('useWorkspace: Resolved active client set to:', resolvedClient.name);
        } else {
          setActiveClientState(null);
          localStorage.removeItem(newClientKey);
        }
      } else {
        console.log('useWorkspace: No organizations found for user');
        setActiveOrgState(null);
        setClients([]);
        setActiveClientState(null);
      }
    } catch (err: any) {
      console.error('Workspace fetch error:', err);
      setError(err.message);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setClients([]);
      setActiveOrgState(null);
      setActiveClientState(null);
      setProfile(null);
      setError(null);
      return;
    }
    fetchWorkspaces();
  }, [user, fetchWorkspaces]);

  const fetchClientsForOrg = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      
      if (error) throw error;
      const activeCls = (data || []).filter(c => {
        const status = c.status?.toLowerCase();
        return status !== 'archived' && status !== 'deleted';
      });
      setClients(activeCls);
      
      if (activeCls && activeCls.length > 0) {
        const storedClientId = user ? localStorage.getItem(`kaeo:${user.id}:activeClientId`) : null;
        const found = activeCls.find(c => c.id === storedClientId) || activeCls[0];
        setActiveClientState(found);
        if (user) {
          localStorage.setItem(`kaeo:${user.id}:activeClientId`, found.id);
        }
      } else {
        setActiveClientState(null);
        if (user) {
          localStorage.removeItem(`kaeo:${user.id}:activeClientId`);
        }
      }
    } catch (err) {
      console.error('Fetch clients error:', err);
    }
  };

  const setActiveOrg = (org: Organization | null) => {
    setActiveOrgState(org);
    if (org && user) {
      localStorage.setItem(`kaeo:${user.id}:activeOrganizationId`, org.id);
      fetchClientsForOrg(org.id);
    }
  };

  const setActiveClient = (client: Client | null) => {
    setActiveClientState(client);
    if (client && user) {
      localStorage.setItem(`kaeo:${user.id}:activeClientId`, client.id);
    }
  };

  const createOrganization = async (name: string, type = 'business') => {
    if (!user) {
      setError('You must be logged in to create a workspace.');
      return null;
    }

    console.log('createOrganization: Payload:', { name, type, created_by: user.id });
    setError(null);

    try {
      // 1. Create Organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, type, created_by: user.id })
        .select()
        .single();

      if (orgError) {
        console.error('createOrganization: organizations insert error:', orgError);
        throw orgError;
      }

      console.log('createOrganization: Organization created:', org);

      // 2. Create Member (Owner)
      const { data: member, error: memError } = await supabase
        .from('organization_members')
        .insert({ 
          organization_id: org.id, 
          user_id: user.id, 
          role: 'owner' 
        })
        .select()
        .single();

      if (memError) {
        console.error('createOrganization: organization_members insert error:', memError);
        throw memError;
      }

      console.log('createOrganization: Member record created:', member);

      // Refresh and select
      await fetchWorkspaces(true);
      setActiveOrgState(org);
      localStorage.setItem(`kaeo:${user.id}:activeOrganizationId`, org.id);
      
      return org;
    } catch (err: any) {
      console.error('createOrganization: Exception caught:', err);
      setError(err.message);
      throw err;
    }
  };

  const createClient = async (name: string, orgId: string, industry?: string, currency = 'INR', metadata: any = {}) => {
    if (!user) {
      setError('You must be logged in to create a client.');
      return null;
    }

    console.log('createClient: Payload:', { name, organization_id: orgId, industry, base_currency: currency, metadata, created_by: user.id });
    setError(null);

    try {
      // Check if client/business with same name already exists under same organization
      const { data: existingClient, error: checkError } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', orgId)
        .ilike('name', name.trim())
        .maybeSingle();

      if (checkError) {
        console.error('createClient: Error checking for existing client:', checkError);
      }

      if (existingClient) {
        setActiveClientState(existingClient);
        localStorage.setItem(`kaeo:${user.id}:activeClientId`, existingClient.id);
        await fetchClientsForOrg(orgId);
        toast('Business already exists. Switched to it.', 'success');
        return existingClient;
      }

      // 1. Enforce monthly client created limit
      const check = await checkUsageEventAllowed(orgId, 'client_created', 1);
      if (!check.allowed) {
        const errMsg = check.message || 'Workspace client creation limit reached. Please upgrade your plan in Billing.';
        setError(errMsg);
        throw new Error(errMsg);
      }

      const { data: client, error: clError } = await supabase
        .from('clients')
        .insert({ 
          name, 
          organization_id: orgId, 
          industry, 
          base_currency: currency,
          metadata,
          created_by: user.id 
        })
        .select()
        .single();

      if (clError) {
        console.error('createClient: clients insert error:', clError);
        throw clError;
      }

      console.log('createClient: Client created:', client);

      // Track usage: client created
      trackUsageEvent({
        organizationId: orgId,
        clientId: client.id,
        eventType: 'client_created',
        quantity: 1,
        userId: user.id
      });

      await fetchClientsForOrg(orgId);
      setActiveClientState(client);
      localStorage.setItem(`kaeo:${user.id}:activeClientId`, client.id);
      
      return client;
    } catch (err: any) {
      console.error('createClient: Exception caught:', err);
      setError(err.message);
      throw err;
    }
  };

  const completeOnboarding = async (
    mode: 'business_owner' | 'accountant',
    answers: any,
    orgName: string,
    clientName?: string,
    clientMetadata: any = {}
  ) => {
    if (!user) {
      setError('You must be logged in to complete onboarding.');
      throw new Error('No user authenticated');
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Create Organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ 
          name: orgName, 
          type: mode === 'business_owner' ? 'business' : 'accountant',
          created_by: user.id 
        })
        .select()
        .single();

      if (orgError) {
        console.error('completeOnboarding: Organization creation error:', orgError);
        throw orgError;
      }

      // 2. Create Organization Member
      const { error: memError } = await supabase
        .from('organization_members')
        .insert({ 
          organization_id: org.id, 
          user_id: user.id, 
          role: 'owner' 
        });

      if (memError) {
        console.error('completeOnboarding: Member record creation error:', memError);
        throw memError;
      }

      // 3. Create Default Client for business_owner
      let client = null;
      if (mode === 'business_owner') {
        const cName = clientName || orgName;
        const { data: newClient, error: clError } = await supabase
          .from('clients')
          .insert({
            name: cName,
            organization_id: org.id,
            industry: clientMetadata.industry || '',
            base_currency: clientMetadata.base_currency || 'INR',
            metadata: clientMetadata,
            created_by: user.id
          })
          .select()
          .single();

        if (clError) {
          console.error('completeOnboarding: Client creation error:', clError);
          throw clError;
        }
        client = newClient;
      }

      // 4. Update Profile
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          account_mode: mode,
          onboarding_completed: true,
          onboarding_answers: answers,
          default_organization_id: org.id
        })
        .eq('id', user.id);

      if (profError) {
        console.error('completeOnboarding: Profile update error:', profError);
        throw profError;
      }

      // 5. Update local storage selections
      localStorage.setItem(`kaeo:${user.id}:activeOrganizationId`, org.id);
      if (client) {
        localStorage.setItem(`kaeo:${user.id}:activeClientId`, client.id);
      } else {
        localStorage.removeItem(`kaeo:${user.id}:activeClientId`);
      }

      // 6. Refresh state
      await fetchWorkspaces(true);

    } catch (err: any) {
      console.error('completeOnboarding error:', err);
      setError(err.message || 'Failed to complete onboarding');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClientMetadata = async (clientId: string, metadata: any) => {
    if (!user) {
      setError('You must be logged in to update client metadata.');
      throw new Error('No user authenticated');
    }
    try {
      const { error: err } = await supabase
        .from('clients')
        .update({ metadata })
        .eq('id', clientId);
        
      if (err) throw err;
      
      // Refresh clients list locally
      if (activeOrg) {
        await fetchClientsForOrg(activeOrg.id);
      }
    } catch (err: any) {
      console.error('updateClientMetadata error:', err);
      setError(err.message || 'Failed to update client metadata');
      throw err;
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      organizations,
      clients,
      activeOrg,
      activeClient,
      profile,
      onboardingCompleted: !!profile?.onboarding_completed,
      accountMode: profile?.account_mode || null,
      loading,
      error,
      setActiveOrg,
      setActiveClient,
      createOrganization,
      createClient,
      completeOnboarding,
      updateClientMetadata,
      isCreateModalOpen,
      setIsCreateModalOpen,
      modalMode,
      setModalMode,
      clientToEdit,
      setClientToEdit,
      refresh: () => fetchWorkspaces(true)
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
