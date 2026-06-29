'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  MessageSquare,
  Shield,
  Languages,
  AlertTriangle,
  Eye,
  Loader2,
} from 'lucide-react';
import {
  approveOutreachMessage,
  getOutreachMessages,
  markOutreachMessageSent,
  rejectOutreachMessage,
  updateOutreachMessage,
} from '@/lib/api';
import {
  getOutreachStatusColor,
  getScoreBadgeColor,
  type OutreachMessage,
} from '@/lib/domain-types';

export function OutreachTab() {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<OutreachMessage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOutreachMessages();
      setMessages(data);
    } catch (e) {
      console.error('Failed to fetch outreach messages:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const pendingCount = messages.filter((m) => m.status === 'Pending').length;
  const approvedCount = messages.filter((m) => m.status === 'Approved').length;
  const sentCount = messages.filter((m) => m.status === 'Sent').length;
  const respondedCount = messages.filter((m) => m.status === 'Responded').length;
  const responseRate = sentCount > 0 ? Math.round((respondedCount / sentCount) * 100) : 0;

  const handleApprove = async (message: OutreachMessage) => {
    if (!message.messageId || !message.conversationId) return;
    setSaving(true);
    try {
      if (editMode && editedMessage !== message.message) {
        await updateOutreachMessage(
          message.messageId,
          message.conversationId,
          editedMessage
        );
      }
      await approveOutreachMessage(message.messageId, message.conversationId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, message: editedMessage, status: 'Approved' as const }
            : m
        )
      );
      setSelectedMessage(null);
      setEditMode(false);
    } catch (e) {
      console.error('Failed to approve:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (message: OutreachMessage) => {
    if (!message.messageId || !message.conversationId) return;
    setSaving(true);
    try {
      await rejectOutreachMessage(
        message.messageId,
        message.conversationId,
        feedback
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, status: 'Draft' as const } : m
        )
      );
      setSelectedMessage(null);
      setEditMode(false);
    } catch (e) {
      console.error('Failed to reject:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSent = async (message: OutreachMessage) => {
    if (!message.messageId || !message.conversationId) return;
    setSaving(true);
    try {
      await markOutreachMessageSent(message.messageId, message.conversationId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, status: 'Sent' as const } : m
        )
      );
      setSelectedMessage(null);
    } catch (e) {
      console.error('Failed to mark message as sent:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMessage = (msg: OutreachMessage) => {
    setSelectedMessage(msg);
    setEditedMessage(msg.message);
    setEditMode(false);
    setFeedback('');
  };

  const allChecksPassed = (checks: OutreachMessage['complianceChecks']) => {
    return Object.values(checks).every(Boolean);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-muted-foreground">Loading outreach messages from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{sentCount}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{responseRate}%</p>
            <p className="text-xs text-muted-foreground">Response Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Pending Approval Queue */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Approval Queue
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px]">
                  {pendingCount} pending
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[560px] overflow-y-auto custom-scrollbar">
              {messages.length === 0 && (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <MessageSquare className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No outreach drafts</p>
                  <p className="text-xs text-muted-foreground">
                    Real drafts will appear after leads enter the outreach workflow.
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedMessage?.id === msg.id
                      ? 'border-teal-300 bg-teal-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => handleSelectMessage(msg)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{msg.leadName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${getOutreachStatusColor(msg.status)}`}
                      >
                        {msg.status}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${getScoreBadgeColor(msg.score)}`}
                    >
                      {msg.score}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1.5">
                    <span>{msg.category}</span>
                    <span>•</span>
                    <span>{msg.city}</span>
                    <span>•</span>
                    <Languages className="h-3 w-3" />
                    <span>{msg.language}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {msg.message}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {allChecksPassed(msg.complianceChecks) ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {allChecksPassed(msg.complianceChecks)
                        ? 'All checks passed'
                        : 'Review needed'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Side-by-side View */}
        <div className="xl:col-span-3">
          {selectedMessage ? (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-teal-600" />
                    Review Message
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${getOutreachStatusColor(selectedMessage.status)}`}
                  >
                    {selectedMessage.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Creator Profile Summary */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-teal-600" />
                    Creator Profile
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      <span className="font-medium">{selectedMessage.leadName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Handle:</span>{' '}
                      <span className="font-medium">{selectedMessage.leadHandle}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category:</span>{' '}
                      <Badge variant="outline" className="text-[9px] h-4">
                        {selectedMessage.category}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">City:</span>{' '}
                      <span className="font-medium">{selectedMessage.city}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Platform:</span>{' '}
                      <span className="font-medium">{selectedMessage.platform}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Score:</span>{' '}
                      <Badge
                        variant="outline"
                        className={`text-[9px] h-4 ${getScoreBadgeColor(selectedMessage.score)}`}
                      >
                        {selectedMessage.score}/100
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Draft Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1">
                      <Edit3 className="h-3 w-3 text-teal-600" />
                      Draft Message ({selectedMessage.language === 'AR' ? 'Arabic' : 'English'})
                    </h4>
                    {!editMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => setEditMode(true)}
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {editMode ? (
                    <Textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="min-h-[100px] text-sm"
                      dir={selectedMessage.language === 'AR' ? 'rtl' : 'ltr'}
                    />
                  ) : (
                    <div
                      className="bg-white border rounded-lg p-3 text-sm leading-relaxed"
                      dir={selectedMessage.language === 'AR' ? 'rtl' : 'ltr'}
                    >
                      {editedMessage}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {editedMessage.split(/\s+/).length} words
                    </span>
                    {selectedMessage.language === 'AR' && (
                      <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border-0 text-[9px]">
                        RTL
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Compliance Checks */}
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <Shield className="h-3 w-3 text-teal-600" />
                    Compliance Checks
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      {selectedMessage.complianceChecks.noIncomePromise ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span>No income promise</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {selectedMessage.complianceChecks.freeRegistrationMentioned ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span>Free registration mentioned</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {selectedMessage.complianceChecks.under80Words ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span>Under 80 words</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {selectedMessage.complianceChecks.arabicLocalization ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span>Arabic localization</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Feedback & Actions */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Feedback (optional)
                    </label>
                    <Input
                      placeholder="Add feedback for the AI agent..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedMessage.status === 'Approved' ? (
                      <Button
                        className="flex-1 bg-purple-700 hover:bg-purple-800 h-9"
                        onClick={() => handleMarkSent(selectedMessage)}
                        disabled={saving}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as Sent
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9"
                        onClick={() => handleApprove(selectedMessage)}
                        disabled={saving || !allChecksPassed(selectedMessage.complianceChecks)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve Draft
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1 h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleReject(selectedMessage)}
                      disabled={saving}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center p-8">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a message from the queue to review
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Review AI-generated messages before they are sent to creators
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Message Status Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Message Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {(['Draft', 'Pending', 'Approved', 'Sent', 'Responded', 'No Response'] as const).map(
              (status) => {
                const count = messages.filter((m) => m.status === status).length;
                return (
                  <div
                    key={status}
                    className="text-center p-3 rounded-lg bg-slate-50"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[9px] mb-1 ${getOutreachStatusColor(status)}`}
                    >
                      {status}
                    </Badge>
                    <p className="text-lg font-bold mt-1">{status === 'Pending' ? pendingCount : status === 'Approved' ? approvedCount : count}</p>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
