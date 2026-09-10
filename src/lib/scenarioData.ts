import type { DemoScenario } from '@/hooks/useDemoScenario';

export interface ScenarioRequestType {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
}

export interface ScenarioRequest {
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

// ============= HR SCENARIO =============
const hrRequestTypes: ScenarioRequestType[] = [
  { id: 'hr-type-001', name: 'Paid Time Off', description: 'Request vacation days or personal time off', category: 'HR', active: true },
  { id: 'hr-type-002', name: 'Remote Work', description: 'Request to work remotely', category: 'HR', active: true },
  { id: 'hr-type-003', name: 'Training Request', description: 'Request professional development or training', category: 'HR', active: true },
  { id: 'hr-type-004', name: 'Expense Report', description: 'Submit expense reimbursement requests', category: 'Finance', active: true },
];

const hrRequests: ScenarioRequest[] = [
  // Pending (8)
  { id: 'hr-req-001', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Annual vacation - family trip to Colorado', status: 'pending', start_date: daysFromNow(14), end_date: daysFromNow(21), created_at: daysAgo(1) },
  { id: 'hr-req-002', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Work from home - conference week', status: 'pending', start_date: daysFromNow(7), end_date: daysFromNow(11), created_at: daysAgo(1) },
  { id: 'hr-req-003', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Leadership workshop enrollment', status: 'pending', created_at: daysAgo(2) },
  { id: 'hr-req-004', type_id: 'hr-type-004', type_name: 'Expense Report', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Client dinner reimbursement - $245', status: 'pending', created_at: daysAgo(2) },
  { id: 'hr-req-005', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Personal day - moving apartments', status: 'pending', start_date: daysFromNow(5), end_date: daysFromNow(5), created_at: daysAgo(3) },
  { id: 'hr-req-006', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Remote work - home renovation', status: 'pending', start_date: daysFromNow(10), end_date: daysFromNow(14), created_at: daysAgo(3) },
  { id: 'hr-req-007', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'AWS certification prep course', status: 'pending', created_at: daysAgo(4) },
  { id: 'hr-req-008', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Sick day - doctor appointment', status: 'pending', start_date: daysFromNow(2), end_date: daysFromNow(2), created_at: daysAgo(0) },
  // In Review (4)
  { id: 'hr-req-009', type_id: 'hr-type-004', type_name: 'Expense Report', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Travel expenses - NYC conference', status: 'in_review', created_at: daysAgo(5) },
  { id: 'hr-req-010', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'WFH - childcare arrangements', status: 'in_review', start_date: daysFromNow(3), end_date: daysFromNow(7), created_at: daysAgo(6) },
  { id: 'hr-req-011', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Team offsite planning week', status: 'in_review', start_date: daysFromNow(30), end_date: daysFromNow(34), created_at: daysAgo(7) },
  { id: 'hr-req-012', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Product management bootcamp', status: 'in_review', created_at: daysAgo(8) },
  // Approved (12)
  { id: 'hr-req-013', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Holiday break - visiting family', status: 'approved', start_date: daysAgo(20), end_date: daysAgo(15), created_at: daysAgo(25) },
  { id: 'hr-req-014', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Remote for home repairs', status: 'approved', start_date: daysAgo(5), end_date: daysAgo(3), created_at: daysAgo(10) },
  { id: 'hr-req-015', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'UX design bootcamp', status: 'approved', created_at: daysAgo(12) },
  { id: 'hr-req-016', type_id: 'hr-type-004', type_name: 'Expense Report', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Office supplies - $89', status: 'approved', created_at: daysAgo(14) },
  { id: 'hr-req-017', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Anniversary celebration', status: 'approved', start_date: daysAgo(8), end_date: daysAgo(7), created_at: daysAgo(18) },
  { id: 'hr-req-018', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'WFH - internet installation', status: 'approved', start_date: daysAgo(3), end_date: daysAgo(3), created_at: daysAgo(11) },
  { id: 'hr-req-019', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Agile scrum certification', status: 'approved', created_at: daysAgo(9) },
  { id: 'hr-req-020', type_id: 'hr-type-004', type_name: 'Expense Report', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Team lunch reimbursement - $156', status: 'approved', created_at: daysAgo(16) },
  { id: 'hr-req-021', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Mental health day', status: 'approved', start_date: daysAgo(12), end_date: daysAgo(12), created_at: daysAgo(20) },
  { id: 'hr-req-022', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Remote - car in service', status: 'approved', start_date: daysAgo(6), end_date: daysAgo(6), created_at: daysAgo(13) },
  { id: 'hr-req-023', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Excel advanced course', status: 'approved', created_at: daysAgo(22) },
  { id: 'hr-req-024', type_id: 'hr-type-004', type_name: 'Expense Report', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Software subscription - $49/mo', status: 'approved', created_at: daysAgo(19) },
  // Rejected (4)
  { id: 'hr-req-025', type_id: 'hr-type-001', type_name: 'Paid Time Off', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Extended vacation - conflicted with deadline', status: 'rejected', start_date: daysAgo(30), end_date: daysAgo(20), created_at: daysAgo(35) },
  { id: 'hr-req-026', type_id: 'hr-type-002', type_name: 'Remote Work', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Full remote - in-person required', status: 'rejected', start_date: daysAgo(25), end_date: daysAgo(20), created_at: daysAgo(28) },
  { id: 'hr-req-027', type_id: 'hr-type-003', type_name: 'Training Request', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Gaming conference - not work related', status: 'rejected', created_at: daysAgo(30) },
  { id: 'hr-req-028', type_id: 'hr-type-004', type_name: 'Expense Report', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Personal meal - not eligible', status: 'rejected', created_at: daysAgo(24) },
];

// ============= OPS SCENARIO =============
const opsRequestTypes: ScenarioRequestType[] = [
  { id: 'ops-type-001', name: 'Office Supplies', description: 'Request office supplies and materials', category: 'Operations', active: true },
  { id: 'ops-type-002', name: 'Facility Maintenance', description: 'Report facility issues or request repairs', category: 'Facilities', active: true },
  { id: 'ops-type-003', name: 'Vendor Onboarding', description: 'Request new vendor setup and approval', category: 'Procurement', active: true },
  { id: 'ops-type-004', name: 'Budget Approval', description: 'Request budget allocation or approval', category: 'Finance', active: true },
];

const opsRequests: ScenarioRequest[] = [
  // Pending (8)
  { id: 'ops-req-001', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Printer paper and toner cartridges', status: 'pending', created_at: daysAgo(1) },
  { id: 'ops-req-002', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'HVAC repair - 3rd floor conference room', status: 'pending', created_at: daysAgo(1) },
  { id: 'ops-req-003', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'New catering vendor for events', status: 'pending', created_at: daysAgo(2) },
  { id: 'ops-req-004', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Q2 marketing campaign - $15,000', status: 'pending', created_at: daysAgo(2) },
  { id: 'ops-req-005', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Standing desk accessories', status: 'pending', created_at: daysAgo(3) },
  { id: 'ops-req-006', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Broken window blinds - Room 204', status: 'pending', created_at: daysAgo(3) },
  { id: 'ops-req-007', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Office cleaning service provider', status: 'pending', created_at: daysAgo(4) },
  { id: 'ops-req-008', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Team building event - $3,500', status: 'pending', created_at: daysAgo(0) },
  // In Review (4)
  { id: 'ops-req-009', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Bulk order whiteboard markers', status: 'in_review', created_at: daysAgo(5) },
  { id: 'ops-req-010', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Elevator inspection scheduling', status: 'in_review', created_at: daysAgo(6) },
  { id: 'ops-req-011', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'IT support contractor setup', status: 'in_review', created_at: daysAgo(7) },
  { id: 'ops-req-012', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Office renovation phase 2 - $45,000', status: 'in_review', created_at: daysAgo(8) },
  // Approved (12)
  { id: 'ops-req-013', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Ergonomic keyboards x10', status: 'approved', created_at: daysAgo(25) },
  { id: 'ops-req-014', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Parking lot repaving', status: 'approved', created_at: daysAgo(10) },
  { id: 'ops-req-015', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Security services contract', status: 'approved', created_at: daysAgo(12) },
  { id: 'ops-req-016', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'New hire equipment budget', status: 'approved', created_at: daysAgo(14) },
  { id: 'ops-req-017', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Conference room chairs', status: 'approved', created_at: daysAgo(18) },
  { id: 'ops-req-018', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Kitchen appliance replacement', status: 'approved', created_at: daysAgo(11) },
  { id: 'ops-req-019', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Printing services vendor', status: 'approved', created_at: daysAgo(9) },
  { id: 'ops-req-020', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Annual software subscriptions', status: 'approved', created_at: daysAgo(16) },
  { id: 'ops-req-021', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Filing cabinets x5', status: 'approved', created_at: daysAgo(20) },
  { id: 'ops-req-022', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Fire alarm system update', status: 'approved', created_at: daysAgo(13) },
  { id: 'ops-req-023', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Office plant maintenance', status: 'approved', created_at: daysAgo(22) },
  { id: 'ops-req-024', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Holiday party budget', status: 'approved', created_at: daysAgo(19) },
  // Rejected (4)
  { id: 'ops-req-025', type_id: 'ops-type-001', type_name: 'Office Supplies', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Personal desk decorations - not covered', status: 'rejected', created_at: daysAgo(35) },
  { id: 'ops-req-026', type_id: 'ops-type-002', type_name: 'Facility Maintenance', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Private office renovation - not approved', status: 'rejected', created_at: daysAgo(28) },
  { id: 'ops-req-027', type_id: 'ops-type-003', type_name: 'Vendor Onboarding', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Unlicensed contractor - compliance issue', status: 'rejected', created_at: daysAgo(30) },
  { id: 'ops-req-028', type_id: 'ops-type-004', type_name: 'Budget Approval', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Luxury retreat - exceeds policy', status: 'rejected', created_at: daysAgo(24) },
];

// ============= IT SCENARIO =============
const itRequestTypes: ScenarioRequestType[] = [
  { id: 'it-type-001', name: 'Software License', description: 'Request new software licenses or renewals', category: 'Software', active: true },
  { id: 'it-type-002', name: 'Hardware Request', description: 'Request new hardware or equipment', category: 'Hardware', active: true },
  { id: 'it-type-003', name: 'Access Permission', description: 'Request system or data access permissions', category: 'Security', active: true },
  { id: 'it-type-004', name: 'Bug Report', description: 'Report system bugs or issues', category: 'Support', active: true },
];

const itRequests: ScenarioRequest[] = [
  // Pending (8)
  { id: 'it-req-001', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Adobe Creative Cloud license renewal', status: 'pending', created_at: daysAgo(1) },
  { id: 'it-req-002', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'MacBook Pro 16" for development', status: 'pending', created_at: daysAgo(1) },
  { id: 'it-req-003', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'AWS console access for deployment', status: 'pending', created_at: daysAgo(2) },
  { id: 'it-req-004', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'CRM sync failing with Salesforce', status: 'pending', created_at: daysAgo(2) },
  { id: 'it-req-005', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Figma Pro team license', status: 'pending', created_at: daysAgo(3) },
  { id: 'it-req-006', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: '27" 4K monitor for home office', status: 'pending', created_at: daysAgo(3) },
  { id: 'it-req-007', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'GitHub organization admin access', status: 'pending', created_at: daysAgo(4) },
  { id: 'it-req-008', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'VPN connection dropping randomly', status: 'pending', created_at: daysAgo(0) },
  // In Review (4)
  { id: 'it-req-009', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'JetBrains All Products Pack', status: 'in_review', created_at: daysAgo(5) },
  { id: 'it-req-010', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Mechanical keyboard - ergonomic', status: 'in_review', created_at: daysAgo(6) },
  { id: 'it-req-011', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Production database read access', status: 'in_review', created_at: daysAgo(7) },
  { id: 'it-req-012', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Email signature not loading in Outlook', status: 'in_review', created_at: daysAgo(8) },
  // Approved (12)
  { id: 'it-req-013', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Slack Enterprise Grid upgrade', status: 'approved', created_at: daysAgo(25) },
  { id: 'it-req-014', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'USB-C docking station', status: 'approved', created_at: daysAgo(10) },
  { id: 'it-req-015', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Jira project admin rights', status: 'approved', created_at: daysAgo(12) },
  { id: 'it-req-016', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Fixed: Login timeout issue', status: 'approved', created_at: daysAgo(14) },
  { id: 'it-req-017', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Notion team workspace', status: 'approved', created_at: daysAgo(18) },
  { id: 'it-req-018', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Wireless mouse and keyboard set', status: 'approved', created_at: daysAgo(11) },
  { id: 'it-req-019', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Google Analytics read access', status: 'approved', created_at: daysAgo(9) },
  { id: 'it-req-020', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Fixed: Calendar sync issue', status: 'approved', created_at: daysAgo(16) },
  { id: 'it-req-021', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: '1Password team vault', status: 'approved', created_at: daysAgo(20) },
  { id: 'it-req-022', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Webcam for video calls', status: 'approved', created_at: daysAgo(13) },
  { id: 'it-req-023', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-005', submitter_name: 'Taylor Morgan', description: 'Stripe dashboard access', status: 'approved', created_at: daysAgo(22) },
  { id: 'it-req-024', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-006', submitter_name: 'Sam Nguyen', description: 'Fixed: SSO redirect loop', status: 'approved', created_at: daysAgo(19) },
  // Rejected (4)
  { id: 'it-req-025', type_id: 'it-type-001', type_name: 'Software License', submitter_id: 'emp-001', submitter_name: 'Alex Rivera', description: 'Gaming software - not work related', status: 'rejected', created_at: daysAgo(35) },
  { id: 'it-req-026', type_id: 'it-type-002', type_name: 'Hardware Request', submitter_id: 'emp-002', submitter_name: 'Maya Patel', description: 'Personal tablet - not covered', status: 'rejected', created_at: daysAgo(28) },
  { id: 'it-req-027', type_id: 'it-type-003', type_name: 'Access Permission', submitter_id: 'emp-003', submitter_name: 'Jordan Lee', description: 'Root server access - security risk', status: 'rejected', created_at: daysAgo(30) },
  { id: 'it-req-028', type_id: 'it-type-004', type_name: 'Bug Report', submitter_id: 'emp-004', submitter_name: 'Chris Thompson', description: 'Duplicate: Already reported issue', status: 'rejected', created_at: daysAgo(24) },
];

// ============= EXPORTS =============
export const scenarioRequestTypes: Record<DemoScenario, ScenarioRequestType[]> = {
  hr: hrRequestTypes,
  ops: opsRequestTypes,
  it: itRequestTypes,
};

export const scenarioRequests: Record<DemoScenario, ScenarioRequest[]> = {
  hr: hrRequests,
  ops: opsRequests,
  it: itRequests,
};

export const scenarioLabels: Record<DemoScenario, string> = {
  hr: 'HR Requests',
  ops: 'Ops/Admin',
  it: 'IT Requests',
};
