import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DemoScenario = 'hr' | 'ops' | 'it';

interface DemoScenarioContextType {
  scenario: DemoScenario;
  setScenario: (scenario: DemoScenario) => void;
  scenarioLabel: string;
}

const STORAGE_KEY = 'demo-scenario';

const scenarioLabels: Record<DemoScenario, string> = {
  hr: 'HR',
  ops: 'Ops',
  it: 'IT',
};

const DemoScenarioContext = createContext<DemoScenarioContextType | undefined>(undefined);

export function DemoScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenarioState] = useState<DemoScenario>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'hr' || stored === 'ops' || stored === 'it') {
        return stored;
      }
    }
    return 'hr';
  });

  const setScenario = (newScenario: DemoScenario) => {
    setScenarioState(newScenario);
    localStorage.setItem(STORAGE_KEY, newScenario);
  };

  // Sync to localStorage on mount if not set
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, scenario);
    }
  }, []);

  return (
    <DemoScenarioContext.Provider
      value={{
        scenario,
        setScenario,
        scenarioLabel: scenarioLabels[scenario],
      }}
    >
      {children}
    </DemoScenarioContext.Provider>
  );
}

export function useDemoScenario() {
  const context = useContext(DemoScenarioContext);
  if (!context) {
    throw new Error('useDemoScenario must be used within a DemoScenarioProvider');
  }
  return context;
}
