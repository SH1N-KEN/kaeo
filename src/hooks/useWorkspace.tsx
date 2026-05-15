import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface Client {
  id: string;
  name: string;
  organization_id: string;
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
  createClient: (name: string, orgId: string) => Promise<Client | null>;
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

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;
      setOrganizations(orgs || []);

      // 2. Load stored selection
      const storedOrgId = localStorage.getItem(`kaeo_org_${user.id}`);
      const storedClientId = localStorage.getItem(`kaeo_client_${user.id}`);

      if (orgs && orgs.length > 0) {
        const foundOrg = orgs.find(o => o.id === storedOrgId) || orgs[0];
        setActiveOrgState(foundOrg);

        // 3. Fetch Clients for active org
        const { data: cls, error: clsError } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', foundOrg.id)
          .order('name');

        if (clsError) throw clsError;
        setClients(cls || []);

        if (cls && cls.length > 0) {
          const foundClient = cls.find(c => c.id === storedClientId) || cls[0];
          setActiveClientState(foundClient);
        } else {
          setActiveClientState(null);
        }
      } else {
        setActiveOrgState(null);
        setClients([]);
        setActiveClientState(null);
      }
    } catch (err: any) {
      console.error('Workspace fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setActiveOrg = (org: Organization | null) => {
    setActiveOrgState(org);
    if (org && user) {
      localStorage.setItem(`kaeo_org_${user.id}`, org.id);
      // Re-fetch clients for this org
      fetchClientsForOrg(org.id);
    }
  };

  const setActiveClient = (client: Client | null) => {
    setActiveClientState(client);
    if (client && user) {
      localStorage.setItem(`kaeo_client_${user.id}`, client.id);
    }
  };

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

  const createOrganization = async (name: string, type = 'business') => {
    if (!user) return null;
    try {
      // 1. Create Organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, type, created_by: user.id })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Create Member (Owner)
      const { error: memError } = await supabase
        .from('organization_members')
        .insert({ organization_id: org.id, user_id: user.id, role: 'owner' });

      if (memError) throw memError;

      await fetchWorkspaces();
      return org;
    } catch (err: any) {
      console.error('Create organization error:', err);
      setError(err.message);
      return null;
    }
  };

  const createClient = async (name: string, orgId: string) => {
    if (!user) return null;
    try {
      const { data: client, error } = await supabase
        .from('clients')
        .insert({ name, organization_id: orgId, created_by: user.id })
        .select()
        .single();

      if (error) throw error;

      await fetchClientsForOrg(orgId);
      return client;
    } catch (err: any) {
      console.error('Create client error:', err);
      setError(err.message);
      return null;
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
      refresh: fetchWorkspaces
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
