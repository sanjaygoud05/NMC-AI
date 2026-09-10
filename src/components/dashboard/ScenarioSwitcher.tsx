import { cn } from '@/lib/utils';
import { useDemoScenario, type DemoScenario } from '@/hooks/useDemoScenario';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ScenarioOption {
  label: string;
  value: DemoScenario;
}

const options: ScenarioOption[] = [
  { label: 'HR', value: 'hr' },
  { label: 'Ops', value: 'ops' },
  { label: 'IT', value: 'it' },
];

interface ScenarioSwitcherProps {
  className?: string;
}

export function ScenarioSwitcher({ className }: ScenarioSwitcherProps) {
  const { scenario, setScenario, scenarioLabel } = useDemoScenario();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'border-muted-foreground/30 text-muted-foreground hover:text-foreground',
            className
          )}
        >
          <span className="hidden sm:inline">Use case: </span>
          {scenarioLabel}
          <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setScenario(option.value)}
            className={scenario === option.value ? 'bg-muted font-medium' : ''}
          >
            <span
              className={`h-2 w-2 rounded-full mr-2 ${
                scenario === option.value ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
