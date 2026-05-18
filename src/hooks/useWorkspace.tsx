import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';

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
}

interface WorkspaceContextType {
  organizations: Organization[];
  clients: Client[];
  activeOrg: Organization | null;
  activeClient: Client | null;
  loading: boolean;
  error: string | null;
  setActiveOrg: (org: Organization | null) => void;
  setActiveClient: (client: Client | null) => void;
  createOrganization: (name: string, type?: string) => Promise<Organization | null>;
  createClient: (name: string, orgId: string, industry?: string, currency?: string) => Promise<Client | null>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);
  const [activeClient, setActiveClientState] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async (isRefresh = false) => {
    if (!user) {
      console.log('useWorkspace: No user found, skipping fetch');
      return;
    }
    
    if (!isRefresh) setLoading(true);
    setError(null);

    console.log('useWorkspace: Fetching workspaces for user:', user.id);

    try {
      // 1. Fetch Organizations
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

      // 2. Load stored selection or pick first
      const storedOrgId = localStorage.getItem(`kaeo_org_${user.id}`);
      const storedClientId = localStorage.getItem(`kaeo_client_${user.id}`);

      if (orgs && orgs.length > 0) {
        const foundOrg = orgs.find(o => o.id === storedOrgId) || orgs[0];
        setActiveOrgState(foundOrg);
        console.log('useWorkspace: Active organization set to:', foundOrg.name);

        // 3. Fetch Clients for active org
        const { data: cls, error: clsError } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', foundOrg.id)
          .order('name');

        if (clsError) {
          console.error('useWorkspace: Error fetching clients:', clsError);
          throw clsError;
        }
        
        console.log('useWorkspace: Clients found for org:', cls?.length || 0);
        setClients(cls || []);

        if (cls && cls.length > 0) {
          const foundClient = cls.find(c => c.id === storedClientId) || cls[0];
          setActiveClientState(foundClient);
          console.log('useWorkspace: Active client set to:', foundClient.name);
        } else {
          setActiveClientState(null);
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
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const fetchClientsForOrg = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
      
      if (data && data.length > 0) {
        const storedClientId = user ? localStorage.getItem(`kaeo_client_${user.id}`) : null;
        const found = data.find(c => c.id === storedClientId) || data[0];
        setActiveClientState(found);
      } else {
        setActiveClientState(null);
      }
    } catch (err) {
      console.error('Fetch clients error:', err);
    }
  };

  const setActiveOrg = (org: Organization | null) => {
    setActiveOrgState(org);
    if (org && user) {
      localStorage.setItem(`kaeo_org_${user.id}`, org.id);
      fetchClientsForOrg(org.id);
    }
  };

  const setActiveClient = (client: Client | null) => {
    setActiveClientState(client);
    if (client && user) {
      localStorage.setItem(`kaeo_client_${user.id}`, client.id);
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
      // IMPORTANT: We use the ID returned from the first insert
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
      localStorage.setItem(`kaeo_org_${user.id}`, org.id);
      
      return org;
    } catch (err: any) {
      console.error('createOrganization: Exception caught:', err);
      setError(err.message);
      throw err; // Re-throw to let modal catch it
    }
  };

  const createClient = async (name: string, orgId: string, industry?: string, currency = 'INR') => {
    if (!user) {
      setError('You must be logged in to create a client.');
      return null;
    }

    console.log('createClient: Payload:', { name, organization_id: orgId, industry, base_currency: currency, created_by: user.id });
    setError(null);

    try {
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
      localStorage.setItem(`kaeo_client_${user.id}`, client.id);
      
      return client;
    } catch (err: any) {
      console.error('createClient: Exception caught:', err);
      setError(err.message);
      throw err;
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      organizations,
      clients,
      activeOrg,
      activeClient,
      loading,
      error,
      setActiveOrg,
      setActiveClient,
      createOrganization,
      createClient,
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
