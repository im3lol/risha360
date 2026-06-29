export type LeadPriority = 'Hot' | 'High' | 'Normal' | 'Low'
export type LeadStage = 'Discovered' | 'Qualified' | 'Assigned' | 'Contacted' | 'Replied' | 'Registered'
export type Category =
  | 'Food'
  | 'Fashion'
  | 'Beauty'
  | 'Lifestyle'
  | 'Comedy'
  | 'Fitness'
  | 'Tech'
  | 'Actor'
  | 'Artist'
  | 'Other'
export type City =
  | 'Riyadh'
  | 'Jeddah'
  | 'Dammam'
  | 'Khobar'
  | 'Makkah'
  | 'Madinah'
  | 'Abha'
  | 'Taif'
  | 'All'
  | 'Unknown'
export type Platform =
  | 'Instagram'
  | 'TikTok'
  | 'YouTube'
  | 'Snapchat'
  | 'X (Twitter)'
  | 'Email'
  | 'WhatsApp'
  | 'Unknown'
export type DiscoveryTool =
  | 'Apify Search'
  | 'Crawlee Playwright'
  | 'Firecrawl'
  | 'Crawl4AI'
  | 'Scrapling'
  | 'Browser-use'
  | 'Manual Import'
  | 'Unknown'
export type BatchStatus = 'Planned' | 'Searching' | 'Processing' | 'Completed' | 'Failed'
export type OutreachStatus = 'Draft' | 'Pending' | 'Approved' | 'Sent' | 'Responded' | 'No Response'
export type MessageLanguage = 'AR' | 'EN'
export type TaskStatus = 'Pending' | 'Running' | 'Completed' | 'Failed'

export interface ScoreBreakdown {
  followers: number
  engagement: number
  saudiRelevance: number
  commercialValue: number
  contactAvailability: number
  brandSafety: number
  signupProbability: number
}

export interface SocialLink {
  platform: Platform
  url: string
  handle: string
  followers?: number
  verified?: boolean
}

export interface Lead {
  id: string
  name: string
  handle: string
  category: Category
  city: City
  followers: number
  score: number
  scoreBreakdown: ScoreBreakdown
  priority: LeadPriority
  stage: LeadStage
  email: string
  phone: string
  platform: Platform
  bio: string
  verified: boolean
  lastActive: string
  avatar: string
  socialLinks: SocialLink[]
  discoveryTool: DiscoveryTool
  accountCategory?: string
  engagementRate?: number
  discoveredAt: string
  assignedAgent: string
}

export interface OutreachMessage {
  id: string
  messageId?: string
  conversationId?: string
  leadId: string
  leadName: string
  leadHandle: string
  category: Category
  city: City
  score: number
  language: MessageLanguage
  message: string
  complianceChecks: {
    noIncomePromise: boolean
    freeRegistrationMentioned: boolean
    under80Words: boolean
    arabicLocalization: boolean
  }
  status: OutreachStatus
  createdAt: string
  platform: Platform
}

export interface DiscoveryBatch {
  id: string
  name: string
  category: Category
  city: City
  platform: Platform
  target: number
  found: number
  status: BatchStatus
  stage?: string
  currentStep?: string
  queries?: string[]
  hashtags?: string[]
  providerReady?: boolean
  processed?: number
  leadsCreated?: number
  errors?: number
  providerRuns?: Array<{
    platform: string
    actorId: string
    runId: string
    status: string
  }>
  startedAt: string
  estimatedCompletion: string
}

export interface AgentTask {
  id: string
  taskType: string
  agent: string
  status: TaskStatus
  priority: LeadPriority
  created: string
  duration: string
  details: string
  error?: string
}

export interface FunnelData {
  stage: string
  count: number
  rate: number
}

export interface CategoryDistribution {
  category: Category
  count: number
  percentage: number
}

export const CATEGORIES: Category[] = [
  'Food',
  'Fashion',
  'Beauty',
  'Lifestyle',
  'Comedy',
  'Fitness',
  'Tech',
  'Actor',
  'Artist',
]
export const CITIES: City[] = [
  'Riyadh',
  'Jeddah',
  'Dammam',
  'Khobar',
  'Makkah',
  'Madinah',
  'Abha',
  'Taif',
]
export const STAGES: LeadStage[] = [
  'Discovered',
  'Qualified',
  'Assigned',
  'Contacted',
  'Replied',
  'Registered',
]

export function getScoreBadgeColor(score: number) {
  if (score >= 80) return 'bg-red-100 text-red-700 border-red-200'
  if (score >= 60) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export function getPriorityBadgeColor(priority: LeadPriority) {
  const colors: Record<LeadPriority, string> = {
    Hot: 'bg-red-100 text-red-700 border-red-200',
    High: 'bg-orange-100 text-orange-700 border-orange-200',
    Normal: 'bg-purple-100 text-purple-700 border-purple-200',
    Low: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return colors[priority]
}

export function getStageBadgeColor(stage: LeadStage) {
  const colors: Record<LeadStage, string> = {
    Discovered: 'bg-slate-100 text-slate-700 border-slate-200',
    Qualified: 'bg-purple-100 text-purple-700 border-purple-200',
    Assigned: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    Contacted: 'bg-blue-100 text-blue-700 border-blue-200',
    Replied: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Registered: 'bg-green-100 text-green-700 border-green-200',
  }
  return colors[stage]
}

export function getBatchStatusColor(status: BatchStatus) {
  const colors: Record<BatchStatus, string> = {
    Planned: 'bg-slate-100 text-slate-700 border-slate-200',
    Searching: 'bg-purple-100 text-purple-700 border-purple-200',
    Processing: 'bg-blue-100 text-blue-700 border-blue-200',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Failed: 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[status]
}

export function getOutreachStatusColor(status: OutreachStatus) {
  const colors: Record<OutreachStatus, string> = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Approved: 'bg-purple-100 text-purple-700 border-purple-200',
    Sent: 'bg-blue-100 text-blue-700 border-blue-200',
    Responded: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'No Response': 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[status]
}

export function getTaskStatusColor(status: TaskStatus) {
  const colors: Record<TaskStatus, string> = {
    Pending: 'bg-slate-100 text-slate-700 border-slate-200',
    Running: 'bg-purple-100 text-purple-700 border-purple-200',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Failed: 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[status]
}
