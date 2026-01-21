import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define valid routes for the application
export type RoutePath = 
  | 'cockpit' 
  | 'inbox'
  | 'devices'
  | 'agents'
  | 'playground'
  | 'flows'
  | 'knowledge' 
  | 'governance' 
  | 'insights' 
  | 'configuration'
  | 'profile';

// Helper to validate routes
const isValidRoute = (path: string): boolean => {
  const validRoutes: RoutePath[] = [
      'cockpit', 
      'inbox',
      'devices',
      'agents', 
      'playground',
      'flows',
      'knowledge',
      'governance', 
      'insights', 
      'configuration',
      'profile'
  ];
  return validRoutes.includes(path as RoutePath);
};

interface NavigationContextType {
  currentRoute: RoutePath;
  navigate: (path: RoutePath) => void;
  getPageTitle: () => string;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  // Initialize state from current hash or default to cockpit
  const getInitialRoute = (): RoutePath => {
    const hash = window.location.hash.replace('#', '');
    return isValidRoute(hash) ? (hash as RoutePath) : 'cockpit';
  };

  const [currentRoute, setCurrentRoute] = useState<RoutePath>(getInitialRoute);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (isValidRoute(hash)) {
        setCurrentRoute(hash as RoutePath);
      } else {
        // Redirect invalid hashes to cockpit
        window.location.hash = '#cockpit';
        setCurrentRoute('cockpit');
      }
    };

    // Set initial hash if empty
    if (!window.location.hash) {
      window.location.hash = '#cockpit';
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: RoutePath) => {
    window.location.hash = `#${path}`;
    // State update happens in useEffect via hashchange event to ensure sync
  };

  const getPageTitle = () => {
    switch (currentRoute) {
      case 'cockpit': return 'Operations Cockpit';
      case 'inbox': return 'Universal Inbox';
      case 'devices': return 'IoT & Physical Devices';
      case 'agents': return 'Agents & Workflows';
      case 'playground': return 'Agent Playground';
      case 'flows': return 'Flows';
      case 'knowledge': return 'Knowledge Base';
      case 'governance': return 'AI Governance';
      case 'insights': return 'Insights & Data';
      case 'configuration': return 'Platform Configuration';
      case 'profile': return 'User Profile';
      default: return 'Operations Cockpit';
    }
  };

  return (
    <NavigationContext.Provider value={{ currentRoute, navigate, getPageTitle }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
