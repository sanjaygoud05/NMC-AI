// Role type used throughout the application
export type AppRole = 'admin' | 'manager' | 'employee';

// All available roles for the role switcher
export const ALL_ROLES: AppRole[] = ['admin', 'manager', 'employee'];

export interface MockProfile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  manager_id: string | null;
  status: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MockUser {
  id: string;
  email: string;
  profile: MockProfile;
  role: AppRole;
}

export interface MockRequest {
  id: string;
  type_id: string;
  type_name: string;
  submitter_id: string;
  submitter_name: string;
  description: string;
  status: 'draft' | 'pending' | 'in_review' | 'approved' | 'rejected';
  start_date?: string;
  end_date?: string;
  created_at: string;
}

// Mock Users for Dev Mode (keyed by role for auth) - Using valid UUIDs
export const mockUsers: Record<AppRole, MockUser> = {
  admin: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@demo.com',
    role: 'admin',
    profile: {
      id: '00000000-0000-0000-0001-000000000001',
      user_id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@demo.com',
      first_name: 'Sarah',
      last_name: 'Chen',
      manager_id: null,
      status: 'active',
      custom_fields: { department: 'Human Resources' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  },
  manager: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'manager@demo.com',
    role: 'manager',
    profile: {
      id: '00000000-0000-0000-0001-000000000002',
      user_id: '00000000-0000-0000-0000-000000000002',
      email: 'manager@demo.com',
      first_name: 'James',
      last_name: 'Wilson',
      manager_id: '00000000-0000-0000-0001-000000000001',
      status: 'active',
      custom_fields: { department: 'Engineering' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  },
  employee: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'employee@demo.com',
    role: 'employee',
    profile: {
      id: '00000000-0000-0000-0001-000000000003',
      user_id: '00000000-0000-0000-0000-000000000003',
      email: 'employee@demo.com',
      first_name: 'Alex',
      last_name: 'Rivera',
      manager_id: '00000000-0000-0000-0001-000000000002',
      status: 'active',
      custom_fields: { department: 'Engineering' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  },
};

// Mock Request Types
export const mockRequestTypes = [
  {
    id: 'type-001',
    name: 'Paid Time Off',
    description: 'Request vacation days or personal time off',
    category: 'HR',
    active: true,
  },
  {
    id: 'type-002',
    name: 'Equipment Request',
    description: 'Request new equipment or hardware',
    category: 'IT',
    active: true,
  },
  {
    id: 'type-003',
    name: 'Remote Work',
    description: 'Request to work remotely',
    category: 'HR',
    active: true,
  },
  {
    id: 'type-004',
    name: 'Training Request',
    description: 'Request professional development or training',
    category: 'HR',
    active: true,
  },
];

// Helper to generate dates relative to today
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const daysFromNow = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

// Mock Requests - Rich dataset for dashboard (28 requests)
export const mockRequests: MockRequest[] = [
  // Recent pending requests (8)
  {
    id: 'req-001',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-001',
    submitter_name: 'Alex Rivera',
    description: 'Annual vacation - family trip to Colorado',
    status: 'pending',
    start_date: daysFromNow(14),
    end_date: daysFromNow(21),
    created_at: daysAgo(1),
  },
  {
    id: 'req-002',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-002',
    submitter_name: 'Maya Patel',
    description: 'New 27" 4K monitor for design work',
    status: 'pending',
    created_at: daysAgo(1),
  },
  {
    id: 'req-003',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-003',
    submitter_name: 'Jordan Lee',
    description: 'Work from home - conference week',
    status: 'pending',
    start_date: daysFromNow(7),
    end_date: daysFromNow(11),
    created_at: daysAgo(2),
  },
  {
    id: 'req-004',
    type_id: 'type-004',
    type_name: 'Training Request',
    submitter_id: 'dev-employee-004',
    submitter_name: 'Chris Thompson',
    description: 'Sales methodology certification course',
    status: 'pending',
    created_at: daysAgo(2),
  },
  {
    id: 'req-005',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-005',
    submitter_name: 'Taylor Morgan',
    description: 'Personal day - moving apartments',
    status: 'pending',
    start_date: daysFromNow(5),
    end_date: daysFromNow(5),
    created_at: daysAgo(3),
  },
  {
    id: 'req-006',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-006',
    submitter_name: 'Sam Nguyen',
    description: 'Standing desk converter for home office',
    status: 'pending',
    created_at: daysAgo(3),
  },
  {
    id: 'req-007',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-001',
    submitter_name: 'Alex Rivera',
    description: 'Remote work - home renovation week',
    status: 'pending',
    start_date: daysFromNow(21),
    end_date: daysFromNow(25),
    created_at: daysAgo(4),
  },
  {
    id: 'req-008',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-002',
    submitter_name: 'Maya Patel',
    description: 'Sick day - doctor appointment',
    status: 'pending',
    start_date: daysFromNow(2),
    end_date: daysFromNow(2),
    created_at: daysAgo(0),
  },
  // In review requests (4)
  {
    id: 'req-009',
    type_id: 'type-004',
    type_name: 'Training Request',
    submitter_id: 'dev-employee-003',
    submitter_name: 'Jordan Lee',
    description: 'Digital marketing masterclass enrollment',
    status: 'in_review',
    created_at: daysAgo(5),
  },
  {
    id: 'req-010',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-005',
    submitter_name: 'Taylor Morgan',
    description: 'Mechanical keyboard - ergonomic setup',
    status: 'in_review',
    created_at: daysAgo(6),
  },
  {
    id: 'req-011',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-manager-001',
    submitter_name: 'James Wilson',
    description: 'Team offsite planning week',
    status: 'in_review',
    start_date: daysFromNow(30),
    end_date: daysFromNow(34),
    created_at: daysAgo(7),
  },
  {
    id: 'req-012',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-004',
    submitter_name: 'Chris Thompson',
    description: 'Client visit preparation - work from hotel',
    status: 'in_review',
    start_date: daysFromNow(10),
    end_date: daysFromNow(12),
    created_at: daysAgo(8),
  },
  // Approved requests (12)
  {
    id: 'req-013',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-001',
    submitter_name: 'Alex Rivera',
    description: 'Holiday break - visiting family',
    status: 'approved',
    start_date: daysAgo(20),
    end_date: daysAgo(15),
    created_at: daysAgo(25),
  },
  {
    id: 'req-014',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-002',
    submitter_name: 'Maya Patel',
    description: 'Wacom tablet for illustration work',
    status: 'approved',
    created_at: daysAgo(10),
  },
  {
    id: 'req-015',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-003',
    submitter_name: 'Jordan Lee',
    description: 'Work from home - internet installation day',
    status: 'approved',
    start_date: daysAgo(5),
    end_date: daysAgo(5),
    created_at: daysAgo(12),
  },
  {
    id: 'req-016',
    type_id: 'type-004',
    type_name: 'Training Request',
    submitter_id: 'dev-employee-004',
    submitter_name: 'Chris Thompson',
    description: 'CRM software training workshop',
    status: 'approved',
    created_at: daysAgo(14),
  },
  {
    id: 'req-017',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-005',
    submitter_name: 'Taylor Morgan',
    description: 'Wedding anniversary celebration',
    status: 'approved',
    start_date: daysAgo(8),
    end_date: daysAgo(7),
    created_at: daysAgo(18),
  },
  {
    id: 'req-018',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-006',
    submitter_name: 'Sam Nguyen',
    description: 'Noise-cancelling headphones',
    status: 'approved',
    created_at: daysAgo(11),
  },
  {
    id: 'req-019',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-001',
    submitter_name: 'Alex Rivera',
    description: 'Work remotely - car maintenance',
    status: 'approved',
    start_date: daysAgo(3),
    end_date: daysAgo(3),
    created_at: daysAgo(9),
  },
  {
    id: 'req-020',
    type_id: 'type-004',
    type_name: 'Training Request',
    submitter_id: 'dev-employee-002',
    submitter_name: 'Maya Patel',
    description: 'UX design bootcamp - online course',
    status: 'approved',
    created_at: daysAgo(16),
  },
  {
    id: 'req-021',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-003',
    submitter_name: 'Jordan Lee',
    description: 'Mental health day',
    status: 'approved',
    start_date: daysAgo(12),
    end_date: daysAgo(12),
    created_at: daysAgo(20),
  },
  {
    id: 'req-022',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-004',
    submitter_name: 'Chris Thompson',
    description: 'Portable charger for travel',
    status: 'approved',
    created_at: daysAgo(22),
  },
  {
    id: 'req-023',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-005',
    submitter_name: 'Taylor Morgan',
    description: 'Remote work - childcare arrangements',
    status: 'approved',
    start_date: daysAgo(6),
    end_date: daysAgo(4),
    created_at: daysAgo(13),
  },
  {
    id: 'req-024',
    type_id: 'type-004',
    type_name: 'Training Request',
    submitter_id: 'dev-employee-006',
    submitter_name: 'Sam Nguyen',
    description: 'Product management certification',
    status: 'approved',
    created_at: daysAgo(19),
  },
  // Rejected requests (4)
  {
    id: 'req-025',
    type_id: 'type-001',
    type_name: 'Paid Time Off',
    submitter_id: 'dev-employee-001',
    submitter_name: 'Alex Rivera',
    description: 'Extended vacation - conflicted with deadline',
    status: 'rejected',
    start_date: daysAgo(30),
    end_date: daysAgo(20),
    created_at: daysAgo(35),
  },
  {
    id: 'req-026',
    type_id: 'type-002',
    type_name: 'Equipment Request',
    submitter_id: 'dev-employee-002',
    submitter_name: 'Maya Patel',
    description: 'Second monitor - already provided',
    status: 'rejected',
    created_at: daysAgo(28),
  },
  {
    id: 'req-027',
    type_id: 'type-003',
    type_name: 'Remote Work',
    submitter_id: 'dev-employee-003',
    submitter_name: 'Jordan Lee',
    description: 'Full remote - in-person meetings required',
    status: 'rejected',
    start_date: daysAgo(25),
    end_date: daysAgo(20),
    created_at: daysAgo(30),
  },
  {
    id: 'req-028',
    type_id: 'type-004',
    type_name: 'Training Request',
    submitter_id: 'dev-employee-004',
    submitter_name: 'Chris Thompson',
    description: 'Gaming conference - not work related',
    status: 'rejected',
    created_at: daysAgo(24),
  },
];

// Mock Notifications
export const mockNotifications = [
  {
    id: 'notif-001',
    user_id: 'dev-manager-001',
    title: 'New Request',
    message: 'Alex Rivera submitted a PTO request',
    read: false,
    created_at: daysAgo(1),
  },
  {
    id: 'notif-002',
    user_id: 'dev-employee-001',
    title: 'Request Approved',
    message: 'Your equipment request has been approved',
    read: true,
    created_at: daysAgo(5),
  },
  {
    id: 'notif-003',
    user_id: 'dev-manager-001',
    title: 'New Request',
    message: 'Maya Patel submitted an equipment request',
    read: false,
    created_at: daysAgo(1),
  },
  {
    id: 'notif-004',
    user_id: 'dev-admin-001',
    title: 'Pending Review',
    message: 'James Wilson request requires your review',
    read: false,
    created_at: daysAgo(7),
  },
];

// Helper function to get requests by submitter ID
export const getRequestsBySubmitter = (submitterId: string): MockRequest[] => {
  return mockRequests
    .filter(req => req.submitter_id === submitterId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// Helper function to get requests within a date range
export const getRequestsInRange = (days: number): MockRequest[] => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return mockRequests.filter(req => {
    const createdAt = new Date(req.created_at);
    return createdAt >= cutoff;
  });
};

// Helper function to count requests by status
export const getRequestMetrics = (requests: MockRequest[]) => {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending' || r.status === 'in_review').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };
};

// Get daily request counts for the volume chart
export const getRequestVolumeByDay = (days: number = 30) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  // Create a map for each day
  const volumeMap = new Map<string, number>();
  
  // Initialize all days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    volumeMap.set(key, 0);
  }
  
  // Count requests per day
  mockRequests.forEach(req => {
    const createdAt = new Date(req.created_at);
    if (createdAt >= cutoff) {
      const key = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
    }
  });
  
  return Array.from(volumeMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));
};

// Get status distribution for the radial chart
export const getStatusDistribution = () => {
  const statusCounts = {
    approved: 0,
    pending: 0,
    in_review: 0,
    rejected: 0,
  };
  
  mockRequests.forEach(req => {
    if (req.status in statusCounts) {
      statusCounts[req.status as keyof typeof statusCounts]++;
    }
  });
  
  const total = mockRequests.length;
  
  return [
    { 
      status: 'approved', 
      label: 'Approved', 
      count: statusCounts.approved, 
      percentage: Math.round((statusCounts.approved / total) * 100),
      fill: 'hsl(var(--status-approved))',
    },
    { 
      status: 'pending', 
      label: 'Pending', 
      count: statusCounts.pending, 
      percentage: Math.round((statusCounts.pending / total) * 100),
      fill: 'hsl(var(--status-pending))',
    },
    { 
      status: 'in_review', 
      label: 'In Review', 
      count: statusCounts.in_review, 
      percentage: Math.round((statusCounts.in_review / total) * 100),
      fill: 'hsl(var(--status-in-review))',
    },
    { 
      status: 'rejected', 
      label: 'Rejected', 
      count: statusCounts.rejected, 
      percentage: Math.round((statusCounts.rejected / total) * 100),
      fill: 'hsl(var(--status-rejected))',
    },
  ];
};

// Get requests grouped by type for the bar chart
export const getRequestsByType = () => {
  const typeCounts = new Map<string, number>();
  
  mockRequests.forEach(req => {
    typeCounts.set(req.type_name, (typeCounts.get(req.type_name) || 0) + 1);
  });
  
  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
};

// ============= NEW PARAMETERIZED HELPERS FOR DASHBOARD FILTERS =============

// Get status distribution from a filtered request array
export const getStatusDistributionFromRequests = (requests: MockRequest[]) => {
  const statusCounts = {
    approved: 0,
    pending: 0,
    in_review: 0,
    rejected: 0,
  };
  
  requests.forEach(req => {
    if (req.status in statusCounts) {
      statusCounts[req.status as keyof typeof statusCounts]++;
    }
  });
  
  const total = requests.length || 1; // Avoid division by zero
  
  return [
    { 
      status: 'approved', 
      label: 'Approved', 
      count: statusCounts.approved, 
      percentage: Math.round((statusCounts.approved / total) * 100),
      fill: 'hsl(var(--status-approved))',
    },
    { 
      status: 'pending', 
      label: 'Pending', 
      count: statusCounts.pending, 
      percentage: Math.round((statusCounts.pending / total) * 100),
      fill: 'hsl(var(--status-pending))',
    },
    { 
      status: 'in_review', 
      label: 'In Review', 
      count: statusCounts.in_review, 
      percentage: Math.round((statusCounts.in_review / total) * 100),
      fill: 'hsl(var(--status-in-review))',
    },
    { 
      status: 'rejected', 
      label: 'Rejected', 
      count: statusCounts.rejected, 
      percentage: Math.round((statusCounts.rejected / total) * 100),
      fill: 'hsl(var(--status-rejected))',
    },
  ];
};

// Get requests grouped by type from a filtered request array
export const getRequestsByTypeFromRequests = (requests: MockRequest[]) => {
  const typeCounts = new Map<string, number>();
  
  requests.forEach(req => {
    typeCounts.set(req.type_name, (typeCounts.get(req.type_name) || 0) + 1);
  });
  
  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
};

// Get volume data from a filtered request array
// For 24h view, shows hourly breakdown; otherwise shows daily
export const getRequestVolumeFromRequests = (requests: MockRequest[], days: number = 30) => {
  const now = new Date();
  
  // For 24-hour view, show hourly breakdown
  if (days === 1) {
    const volumeMap = new Map<string, number>();
    
    // Initialize all 24 hours with 0
    for (let i = 23; i >= 0; i--) {
      const date = new Date(now);
      date.setHours(date.getHours() - i);
      const hour = date.getHours();
      const key = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
      volumeMap.set(key, 0);
    }
    
    // Count requests per hour from the filtered array
    const cutoff = new Date(now);
    cutoff.setHours(cutoff.getHours() - 24);
    
    requests.forEach(req => {
      const createdAt = new Date(req.created_at);
      if (createdAt >= cutoff) {
        const hour = createdAt.getHours();
        const key = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
        if (volumeMap.has(key)) {
          volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
        }
      }
    });
    
    return Array.from(volumeMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }
  
  // For longer periods, show daily breakdown
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const volumeMap = new Map<string, number>();
  
  // Initialize all days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    volumeMap.set(key, 0);
  }
  
  // Count requests per day from the filtered array
  requests.forEach(req => {
    const createdAt = new Date(req.created_at);
    if (createdAt >= cutoff) {
      const key = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
    }
  });
  
  return Array.from(volumeMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));
};

// Get unique request types for filter dropdown
export const getUniqueRequestTypes = (): string[] => {
  const types = new Set<string>();
  mockRequests.forEach(req => types.add(req.type_name));
  return Array.from(types).sort();
};

// Get unique statuses for filter dropdown
export const getUniqueStatuses = (): string[] => {
  return ['pending', 'in_review', 'approved', 'rejected'];
};

// Helper to convert time range to days
export const timeRangeToDays = (range: string): number => {
  switch (range) {
    case '24h': return 1;
    case '7d': return 7;
    case '30d': return 30;
    default: return 7;
  }
};

// Helper to get label for time range
export const getTimeRangeLabel = (range: string): string => {
  switch (range) {
    case '24h': return 'Last 24 hours';
    case '7d': return 'Last 7 days';
    case '30d': return 'Last 30 days';
    default: return 'Last 7 days';
  }
};

// ============= SCENARIO-AWARE HELPERS =============
import type { DemoScenario } from '@/hooks/useDemoScenario';
import { scenarioRequests, scenarioRequestTypes, type ScenarioRequest } from '@/lib/scenarioData';

// Get requests for a specific scenario
export const getScenarioRequests = (scenario: DemoScenario): ScenarioRequest[] => {
  return scenarioRequests[scenario];
};

// Get request types for a specific scenario
export const getScenarioRequestTypes = (scenario: DemoScenario) => {
  return scenarioRequestTypes[scenario];
};

// Get unique request type names for a scenario
export const getUniqueRequestTypesForScenario = (scenario: DemoScenario): string[] => {
  const types = new Set<string>();
  scenarioRequests[scenario].forEach(req => types.add(req.type_name));
  return Array.from(types).sort();
};

// Get requests within a date range for a scenario
export const getScenarioRequestsInRange = (scenario: DemoScenario, days: number): ScenarioRequest[] => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return scenarioRequests[scenario].filter(req => {
    const createdAt = new Date(req.created_at);
    return createdAt >= cutoff;
  });
};

// Get metrics from scenario requests
export const getScenarioRequestMetrics = (requests: ScenarioRequest[]) => {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending' || r.status === 'in_review').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };
};

// Get status distribution from scenario requests
export const getScenarioStatusDistribution = (requests: ScenarioRequest[]) => {
  const statusCounts = {
    approved: 0,
    pending: 0,
    in_review: 0,
    rejected: 0,
  };
  
  requests.forEach(req => {
    if (req.status in statusCounts) {
      statusCounts[req.status as keyof typeof statusCounts]++;
    }
  });
  
  const total = requests.length || 1;
  
  return [
    { status: 'approved', label: 'Approved', count: statusCounts.approved, percentage: Math.round((statusCounts.approved / total) * 100), fill: 'hsl(var(--status-approved))' },
    { status: 'pending', label: 'Pending', count: statusCounts.pending, percentage: Math.round((statusCounts.pending / total) * 100), fill: 'hsl(var(--status-pending))' },
    { status: 'in_review', label: 'In Review', count: statusCounts.in_review, percentage: Math.round((statusCounts.in_review / total) * 100), fill: 'hsl(var(--status-in-review))' },
    { status: 'rejected', label: 'Rejected', count: statusCounts.rejected, percentage: Math.round((statusCounts.rejected / total) * 100), fill: 'hsl(var(--status-rejected))' },
  ];
};

// Get requests by type from scenario requests
export const getScenarioRequestsByType = (requests: ScenarioRequest[]) => {
  const typeCounts = new Map<string, number>();
  requests.forEach(req => {
    typeCounts.set(req.type_name, (typeCounts.get(req.type_name) || 0) + 1);
  });
  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
};

// Get volume data from scenario requests
export const getScenarioRequestVolume = (requests: ScenarioRequest[], days: number = 30) => {
  const now = new Date();
  
  if (days === 1) {
    const volumeMap = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const date = new Date(now);
      date.setHours(date.getHours() - i);
      const hour = date.getHours();
      const key = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
      volumeMap.set(key, 0);
    }
    
    const cutoff = new Date(now);
    cutoff.setHours(cutoff.getHours() - 24);
    
    requests.forEach(req => {
      const createdAt = new Date(req.created_at);
      if (createdAt >= cutoff) {
        const hour = createdAt.getHours();
        const key = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
        if (volumeMap.has(key)) {
          volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
        }
      }
    });
    
    return Array.from(volumeMap.entries()).map(([date, count]) => ({ date, count }));
  }
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const volumeMap = new Map<string, number>();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    volumeMap.set(key, 0);
  }
  
  requests.forEach(req => {
    const createdAt = new Date(req.created_at);
    if (createdAt >= cutoff) {
      const key = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
    }
  });
  
  return Array.from(volumeMap.entries()).map(([date, count]) => ({ date, count }));
};
