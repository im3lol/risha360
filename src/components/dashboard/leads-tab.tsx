'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MessageSquare,
  UserPlus,
  AlertCircle,
  MapPin,
  Users,
  ExternalLink,
  Trash2,
  Sparkles,
  Star,
  Shield,
  TrendingUp,
  CheckCircle2,
  Wrench,
  Clock,
  Instagram,
  Youtube,
  Music2,
  Camera,
  Twitter,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  ChartContainer,
} from '@/components/ui/chart';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { getLeads, deleteLead, cleanupNonPersons } from '@/lib/api';
import {
  CATEGORIES,
  CITIES,
  STAGES,
  getScoreBadgeColor,
  getPriorityBadgeColor,
  getStageBadgeColor,
  type Lead,
  type SocialLink,
  type Platform,
  type DiscoveryTool,
} from '@/lib/domain-types';

const scoreDimensions = [
  { key: 'followers', label: 'Followers', max: 25 },
  { key: 'engagement', label: 'Engagement', max: 25 },
  { key: 'saudiRelevance', label: 'Saudi Relevance', max: 15 },
  { key: 'commercialValue', label: 'Commercial', max: 10 },
  { key: 'contactAvailability', label: 'Contact', max: 10 },
  { key: 'brandSafety', label: 'Brand Safety', max: 10 },
  { key: 'signupProbability', label: 'Signup Prob.', max: 5 },
];

const platformIcons: Partial<Record<Platform, React.ElementType>> = {
  'Instagram': Instagram,
  'TikTok': Music2,
  'YouTube': Youtube,
  'Snapchat': Camera,
  'X (Twitter)': Twitter,
};

const platformColors: Partial<Record<Platform, string>> = {
  'Instagram': 'text-pink-600 bg-pink-50 border-pink-200',
  'TikTok': 'text-slate-800 bg-slate-50 border-slate-300',
  'YouTube': 'text-red-600 bg-red-50 border-red-200',
  'Snapchat': 'text-yellow-500 bg-yellow-50 border-yellow-200',
  'X (Twitter)': 'text-sky-600 bg-sky-50 border-sky-200',
};

const discoveryToolColors: Record<string, string> = {
  'Apify Instagram Scraper': 'bg-blue-100 text-blue-700 border-blue-200',
  'Apify TikTok Scraper': 'bg-purple-100 text-purple-700 border-purple-200',
  'Crawlee Playwright': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Firecrawl': 'bg-orange-100 text-orange-700 border-orange-200',
  'Crawl4AI': 'bg-amber-100 text-amber-700 border-amber-200',
  'Scrapling': 'bg-teal-100 text-teal-700 border-teal-200',
  'Browser-use': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Manual Import': 'bg-slate-100 text-slate-700 border-slate-200',
  'Unknown': 'bg-slate-100 text-slate-700 border-slate-200',
};

export function LeadsTab() {
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getLeads({ limit: 100 });
      setLeadsData(data);
    } catch (e) {
      console.error('Failed to fetch leads:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Manually remove an unsuitable lead (and its underlying influencer/profiles).
  const handleDelete = useCallback(async (lead: Lead) => {
    if (!window.confirm(`حذف @${lead.handle} نهائيًّا من البيانات؟`)) return;
    setDeletingId(lead.id);
    setLeadsData((prev) => prev.filter((l) => l.id !== lead.id)); // optimistic
    try {
      await deleteLead(lead.id);
    } catch (e) {
      console.error('Delete failed:', e);
      await fetchLeads(); // restore on failure
    } finally {
      setDeletingId(null);
    }
  }, [fetchLeads]);

  // Auto data-quality pass: find and remove non-person accounts (restaurants,
  // shops, places, news/guide pages). Previews the count first, then confirms.
  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    try {
      const preview = await cleanupNonPersons(true); // dry-run
      if (preview.flagged === 0) {
        window.alert(`فحص ${preview.scanned} حساب — كلهم أشخاص ✅ (مفيش غير-أشخاص).`);
        return;
      }
      const list = preview.samples.map((s) => `• @${s.handle} (${s.reason})`).join('\n');
      const ok = window.confirm(
        `الفحص لقى ${preview.flagged} حساب مش لأشخاص (مطاعم/أماكن/صفحات) من ${preview.scanned}.\n\nأمثلة:\n${list}\n\nأحذفهم كلهم؟`
      );
      if (!ok) return;
      const res = await cleanupNonPersons(false);
      window.alert(`اتشال ${res.removed} حساب غير-شخص ✅`);
      await fetchLeads();
    } catch (e) {
      console.error('Cleanup failed:', e);
      window.alert('فشل التنظيف — حاول تاني.');
    } finally {
      setCleaning(false);
    }
  }, [fetchLeads]);

  const filteredLeads = leadsData.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.handle.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || lead.category === categoryFilter;
    const matchesCity = cityFilter === 'all' || lead.city === cityFilter;
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    const matchesScore = lead.score >= scoreMin && lead.score <= scoreMax;
    return matchesSearch && matchesCategory && matchesCity && matchesStage && matchesScore;
  });

  const formatFollowers = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const getRadarData = (lead: Lead) => {
    return scoreDimensions.map((dim) => ({
      dimension: dim.label,
      value: lead.scoreBreakdown[dim.key as keyof typeof lead.scoreBreakdown],
      fullMark: dim.max,
    }));
  };

  const getTimelineEvents = (lead: Lead) => {
    const events = [
      { date: lead.discoveredAt, event: `Lead discovered via ${lead.discoveryTool}`, status: 'completed' },
    ];
    if (lead.stage !== 'Discovered') {
      events.push({ date: lead.discoveredAt, event: 'Qualified with score ' + lead.score, status: 'completed' });
    }
    if (['Assigned', 'Contacted', 'Replied', 'Registered'].includes(lead.stage)) {
      events.push({ date: lead.discoveredAt, event: `Assigned to ${lead.assignedAgent}`, status: 'completed' });
    }
    if (['Contacted', 'Replied', 'Registered'].includes(lead.stage)) {
      events.push({ date: lead.discoveredAt, event: 'Outreach message sent via ' + lead.platform, status: 'completed' });
    }
    if (['Replied', 'Registered'].includes(lead.stage)) {
      events.push({ date: lead.discoveredAt, event: 'Creator responded to outreach', status: 'completed' });
    }
    if (lead.stage === 'Registered') {
      events.push({ date: lead.discoveredAt, event: 'Successfully registered on Risha360', status: 'completed' });
    }
    if (lead.stage === 'Discovered') {
      events.push({ date: 'Pending', event: 'Awaiting qualification review', status: 'pending' });
    }
    if (lead.stage === 'Qualified') {
      events.push({ date: 'Pending', event: 'Awaiting sales assignment', status: 'pending' });
    }
    if (lead.stage === 'Assigned') {
      events.push({ date: 'Pending', event: 'Invitation draft awaiting human approval', status: 'pending' });
    }
    if (lead.stage === 'Contacted') {
      events.push({ date: 'Pending', event: 'Awaiting creator response', status: 'pending' });
    }
    return events;
  };

  const renderSocialLink = (link: SocialLink, size: 'sm' | 'md' = 'sm') => {
    const Icon = platformIcons[link.platform] || ExternalLink;
    const colorClass = platformColors[link.platform] || 'text-slate-600 bg-slate-50 border-slate-200';
    const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

    return (
      <Tooltip key={link.url}>
        <TooltipTrigger asChild>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium transition-colors hover:opacity-80 ${colorClass}`}
          >
            <Icon className={iconSize} />
            {size === 'md' && (
              <span>{link.handle}</span>
            )}
            {link.followers && size === 'md' && (
              <span className="text-[9px] opacity-70">({formatFollowers(link.followers)})</span>
            )}
            {link.verified && <CheckCircle2 className="h-2.5 w-2.5" />}
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{link.platform}</span>
            <span>{link.handle}</span>
            {link.followers && <span>{formatFollowers(link.followers)} followers</span>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-muted-foreground">Loading leads from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search creators by name or handle..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {CITIES.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <Users className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Score:</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreMin}
                  onChange={(e) => setScoreMin(Number(e.target.value))}
                  className="w-16 h-9 text-center"
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreMax}
                  onChange={(e) => setScoreMax(Number(e.target.value))}
                  className="w-16 h-9 text-center"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={fetchLeads}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => void handleCleanup()}
                disabled={cleaning}
                title="فحص وإزالة الحسابات اللي مش لأشخاص (مطاعم/أماكن/صفحات)"
              >
                <Sparkles className={`h-3.5 w-3.5 mr-1 ${cleaning ? 'animate-pulse' : ''}`} />
                {cleaning ? 'بيفحص…' : 'تنظيف غير-الأشخاص'}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Showing {filteredLeads.length} of {leadsData.length} creators
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[180px]">Creator</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Sales Agent</TableHead>
                    <TableHead>Social Links</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="h-40 text-center">
                        <div className="space-y-1">
                          <p className="font-medium">No real leads found</p>
                          <p className="text-xs text-muted-foreground">
                            Run a discovery plan or change the current filters.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredLeads.map((lead) => (
                    <Fragment key={lead.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-teal-50/30 transition-colors"
                        onClick={() =>
                          setExpandedLead(expandedLead === lead.id ? null : lead.id)
                        }
                      >
                        <TableCell className="pl-3">
                          {expandedLead === lead.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-medium">
                                {lead.avatar}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm">{lead.name}</span>
                                {lead.verified && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {lead.handle}
                                {lead.platform ? ` · ${lead.platform}` : ''}
                                {lead.accountCategory ? ` · ${lead.accountCategory}` : ''}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {lead.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{lead.city}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatFollowers(lead.followers)}
                          {lead.engagementRate ? (
                            <span className="block text-[10px] font-normal text-emerald-600">
                              {lead.engagementRate}% eng.
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-bold ${getScoreBadgeColor(lead.score)}`}
                          >
                            {lead.score}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.assignedAgent}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${getPriorityBadgeColor(lead.priority)}`}
                          >
                            {lead.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${getStageBadgeColor(lead.stage)}`}
                          >
                            {lead.stage}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {lead.socialLinks.map((link) => {
                              const Icon = platformIcons[link.platform] || ExternalLink;
                              const colorClass = platformColors[link.platform] || '';
                              return (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md border text-[10px] transition-colors hover:opacity-80 ${colorClass}`}
                                  title={`${link.platform}: ${link.handle}${link.followers ? ` (${formatFollowers(link.followers)})` : ''}`}
                                >
                                  <Icon className="h-3 w-3" />
                                </a>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[8px] max-w-[100px] truncate ${discoveryToolColors[lead.discoveryTool] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                            title={lead.discoveryTool}
                          >
                            <Wrench className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                            <span className="truncate">{lead.discoveryTool}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              disabled={deletingId === lead.id}
                              title="حذف هذا المؤثر نهائيًّا"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(lead);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedLead === lead.id && (
                        <TableRow key={`${lead.id}-detail`}>
                          <TableCell colSpan={11} className="bg-slate-50/50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              {/* Identity Card */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-12 w-12">
                                    <AvatarFallback className="bg-teal-100 text-teal-700 font-medium">
                                      {lead.avatar}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <h4 className="font-semibold text-sm">{lead.name}</h4>
                                    <p className="text-xs text-muted-foreground">{lead.handle}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{lead.bio}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    {lead.city}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Users className="h-3 w-3 text-muted-foreground" />
                                    {formatFollowers(lead.followers)} followers
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {lead.email}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {lead.phone}
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Platform: {lead.platform} &bull; Last active: {lead.lastActive}
                                </div>
                              </div>

                              {/* Social Media Links */}
                              <div>
                                <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3 text-teal-600" />
                                  Social Media ({lead.socialLinks.length} accounts)
                                </h5>
                                <div className="space-y-1.5">
                                  {lead.socialLinks.map((link) => (
                                    <div
                                      key={link.url}
                                      className="flex items-center gap-2 p-1.5 rounded-md bg-white border border-slate-100"
                                    >
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 flex-1 min-w-0"
                                      >
                                        {(() => {
                                          const Icon = platformIcons[link.platform] || ExternalLink;
                                          return <Icon className="h-3.5 w-3.5 shrink-0" />;
                                        })()}
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-medium truncate">{link.handle}</span>
                                            {link.verified && <CheckCircle2 className="h-2.5 w-2.5 text-teal-600 shrink-0" />}
                                          </div>
                                          <span className="text-[9px] text-muted-foreground">{link.platform}</span>
                                        </div>
                                      </a>
                                      {link.followers && (
                                        <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                          {formatFollowers(link.followers)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Score Breakdown */}
                              <div>
                                <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                                  <Star className="h-3 w-3 text-teal-600" />
                                  Score Breakdown ({lead.score}/100)
                                </h5>
                                <div className="space-y-1.5">
                                  {scoreDimensions.map((dim) => {
                                    const val = lead.scoreBreakdown[dim.key as keyof typeof lead.scoreBreakdown];
                                    return (
                                      <div key={dim.key} className="space-y-0.5">
                                        <div className="flex justify-between text-[10px]">
                                          <span>{dim.label}</span>
                                          <span className="font-medium">
                                            {val}/{dim.max}
                                          </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-teal-500 rounded-full"
                                            style={{ width: `${(val / dim.max) * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Discovery Source & Timeline */}
                              <div>
                                <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                                  <Wrench className="h-3 w-3 text-teal-600" />
                                  Discovery Source
                                </h5>
                                <div className="p-2 rounded-lg bg-white border border-slate-100 mb-3">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${discoveryToolColors[lead.discoveryTool] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                                  >
                                    <Wrench className="h-3 w-3 mr-1" />
                                    {lead.discoveryTool}
                                  </Badge>
                                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    Discovered: {lead.discoveredAt}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    Primary: {lead.platform}
                                  </div>
                                </div>
                                <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3 text-teal-600" />
                                  Timeline
                                </h5>
                                <div className="space-y-1.5">
                                  {getTimelineEvents(lead).map((evt, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <div
                                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                          evt.status === 'completed'
                                            ? 'bg-emerald-500'
                                            : 'bg-amber-400'
                                        }`}
                                      />
                                      <div>
                                        <p className="text-[9px] font-medium leading-tight">{evt.event}</p>
                                        <p className="text-[9px] text-muted-foreground">
                                          {evt.date}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-1.5 mt-3">
                                  <Button size="sm" className="h-6 text-[10px] bg-teal-600 hover:bg-teal-700 px-2">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    Message
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Assign
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Escalate
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Lead Profile Dialog */}
        <Dialog
          open={!!selectedLead}
          onOpenChange={() => setSelectedLead(null)}
        >
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {selectedLead && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-teal-100 text-teal-700 text-xs">
                        {selectedLead.avatar}
                      </AvatarFallback>
                    </Avatar>
                    {selectedLead.name}
                    {selectedLead.verified && (
                      <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    )}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <p className="text-lg font-bold text-teal-700">{selectedLead.score}</p>
                      <p className="text-[10px] text-muted-foreground">Score</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <p className="text-lg font-bold">{formatFollowers(selectedLead.followers)}</p>
                      <p className="text-[10px] text-muted-foreground">Followers</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <Badge variant="outline" className={getPriorityBadgeColor(selectedLead.priority)}>
                        {selectedLead.priority}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">Priority</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <Badge variant="outline" className={getStageBadgeColor(selectedLead.stage)}>
                        {selectedLead.stage}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">Stage</p>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{selectedLead.bio}</p>
                    <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedLead.city}</span>
                      <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{selectedLead.platform}</span>
                      <span>Last active: {selectedLead.lastActive}</span>
                    </div>
                  </div>

                  {/* Social Media Links */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 text-teal-600" />
                      Social Media Accounts ({selectedLead.socialLinks.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedLead.socialLinks.map((link) => (
                        <div
                          key={link.url}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white"
                        >
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 flex-1 min-w-0"
                          >
                            {(() => {
                              const Icon = platformIcons[link.platform] || ExternalLink;
                              const colorClass = platformColors[link.platform] || '';
                              return (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorClass}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium truncate">{link.handle}</span>
                                {link.verified && <CheckCircle2 className="h-3 w-3 text-teal-600 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{link.platform}</span>
                            </div>
                          </a>
                          {link.followers && (
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold">{formatFollowers(link.followers)}</p>
                              <p className="text-[9px] text-muted-foreground">followers</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discovery Source */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <Wrench className="h-3 w-3 text-teal-600" />
                      Discovery Source
                    </h4>
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${discoveryToolColors[selectedLead.discoveryTool] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          {selectedLead.discoveryTool}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Discovered: {selectedLead.discoveredAt}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Primary Platform: {selectedLead.platform}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score Radar */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Score Breakdown</h4>
                    <ChartContainer
                      config={{
                        value: { label: 'Score', color: '#0F766E' },
                      }}
                      className="h-[220px] w-full"
                    >
                      <RadarChart data={getRadarData(selectedLead)}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9 }} />
                        <PolarRadiusAxis tick={{ fontSize: 8 }} />
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="#0F766E"
                          fill="#0F766E"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ChartContainer>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
