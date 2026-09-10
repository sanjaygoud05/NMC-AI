import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Plus, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import { NewRequestSheet } from '@/components/requests/NewRequestSheet';

interface VolumeData {
  date: string;
  count: number;
}

interface RequestVolumeChartProps {
  data: VolumeData[];
  timeLabel?: string;
}

// Unique gradient ID for this chart
const VOLUME_GRADIENT_ID = 'volumeBarGradient';

// Custom bar shape with background, gradient body, and bright cap
const CustomBarShape = (props: any) => {
  const { x, y, width, height, background } = props;
  
  const capHeight = 3;
  const barHeight = height > 0 ? Math.max(0, height - capHeight) : 0;
  const barY = height > 0 ? y + capHeight : y + background.height;
  
  return (
    <g>
      {/* Background bar extending to full height */}
      <rect 
        x={x} 
        y={background.y} 
        width={width} 
        height={background.height} 
        fill="hsl(var(--muted))" 
      />
      {/* Main bar body with gradient */}
      {height > 0 && (
        <>
          <rect 
            x={x} 
            y={barY} 
            width={width} 
            height={barHeight} 
            fill={`url(#${VOLUME_GRADIENT_ID})`}
          />
          {/* Bright cap at top */}
          <rect 
            x={x} 
            y={y} 
            width={width} 
            height={capHeight} 
            fill="#2F9976" 
          />
        </>
      )}
    </g>
  );
};

export function RequestVolumeChart({ data, timeLabel = 'Last 30 days' }: RequestVolumeChartProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Calculate trend (compare last 7 days to previous 7 days)
  const trend = useMemo(() => {
    if (data.length < 14) return { value: 0, isPositive: true };
    
    const recent = data.slice(-7).reduce((sum, d) => sum + d.count, 0);
    const previous = data.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
    
    if (previous === 0) return { value: 0, isPositive: true };
    
    const percentChange = ((recent - previous) / previous) * 100;
    return {
      value: Math.abs(percentChange).toFixed(1),
      isPositive: percentChange >= 0,
    };
  }, [data]);

  // Check if there's any data
  const hasData = data.some(d => d.count > 0);

  // Get the max value for scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <>
      <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '250ms' }}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-foreground">
              Request Volume
            </CardTitle>
            {hasData && (
              <Badge 
                variant="secondary" 
                className={`gap-1 border-none ${
                  trend.isPositive 
                    ? 'text-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved))]/10' 
                    : 'text-[hsl(var(--status-rejected))] bg-[hsl(var(--status-rejected))]/10'
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{trend.value}%</span>
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {timeLabel}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {hasData ? (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={data} 
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                  barCategoryGap="8%"
                >
                  <defs>
                    <linearGradient id={VOLUME_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2F9976" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#2F9976" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickMargin={8}
                  />
                  <YAxis hide />
                  <Bar 
                    dataKey="count" 
                    shape={<CustomBarShape />}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium">No requests yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Submit your first request to see activity here
              </p>
              <Button 
                variant="secondary" 
                className="mt-4 gap-2"
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <NewRequestSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen} 
      />
    </>
  );
}