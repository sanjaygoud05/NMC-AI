import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from 'recharts';

interface StatusData {
  status: string;
  label: string;
  count: number;
  percentage: number;
  fill: string;
}

interface StatusDistributionChartProps {
  data: StatusData[];
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  // Reverse data so Approved is outermost, Rejected is innermost
  const reversedData = [...data].reverse();

  // Transform data for radial bar chart - each status gets its own ring
  const chartData = reversedData.map((item, index) => ({
    ...item,
    // Ring thickness: ~15px, gap between rings: ~6px
    innerRadius: 35 + (index * 21),
    outerRadius: 50 + (index * 21),
  }));

  return (
    <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '300ms' }}>
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">
            Status Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Current request breakdown
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center">
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="25%"
                outerRadius="100%"
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis 
                  type="number" 
                  domain={[0, 100]} 
                  angleAxisId={0} 
                  tick={false} 
                />
                <RadialBar
                  background={{ fill: 'hsl(var(--muted))' }}
                  dataKey="percentage"
                  cornerRadius={4}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full max-w-[280px]">
            {data.map((item) => (
              <div key={item.status} className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {item.label}
                </span>
                <span className="text-xs font-medium text-foreground ml-auto">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}