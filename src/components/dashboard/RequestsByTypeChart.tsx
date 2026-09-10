import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';

interface TypeData {
  type: string;
  count: number;
}

interface RequestsByTypeChartProps {
  data: TypeData[];
}

// Unique gradient ID for this chart
const TYPE_GRADIENT_ID = 'typeBarGradient';

// Custom horizontal bar shape with background, gradient body, and bright cap on the right
const CustomHorizontalBarShape = (props: any) => {
  const { x, y, width, height, background } = props;
  
  const capWidth = 3;
  const barWidth = width > 0 ? Math.max(0, width - capWidth) : 0;
  
  return (
    <g>
      {/* Background bar extending to full width */}
      <rect 
        x={background.x} 
        y={y} 
        width={background.width} 
        height={height} 
        fill="hsl(var(--muted))" 
      />
      {/* Main bar body with gradient */}
      {width > 0 && (
        <>
          <rect 
            x={x} 
            y={y} 
            width={barWidth} 
            height={height} 
            fill={`url(#${TYPE_GRADIENT_ID})`}
          />
          {/* Bright cap at right end */}
          <rect 
            x={x + barWidth} 
            y={y} 
            width={capWidth} 
            height={height} 
            fill="#2F9976" 
          />
        </>
      )}
    </g>
  );
};

export function RequestsByTypeChart({ data }: RequestsByTypeChartProps) {
  return (
    <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '350ms' }}>
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">
            Requests by Type
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Category breakdown
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              layout="vertical"
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <defs>
                <linearGradient id={TYPE_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2F9976" stopOpacity={0} />
                  <stop offset="100%" stopColor="#2F9976" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickMargin={4}
              />
              <YAxis 
                type="category"
                dataKey="type"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                width={100}
              />
              <Bar 
                dataKey="count" 
                shape={<CustomHorizontalBarShape />}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}