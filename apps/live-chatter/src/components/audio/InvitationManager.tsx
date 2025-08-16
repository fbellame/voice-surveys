import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Edit, Trash2, Plus, Mail, Phone, User, ExternalLink, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SurveyInvitation = Database['public']['Tables']['survey_invitations']['Row'];
type Campaign = Database['public']['Tables']['campaign']['Row'];

interface InvitationManagerProps {
  campaign: Campaign;
  onRefresh?: () => void;
}

export function InvitationManager({ campaign, onRefresh }: InvitationManagerProps) {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingInvitation, setEditingInvitation] = useState<SurveyInvitation | null>(null);
  const [formData, setFormData] = useState({
    contact_value: '',
    invitation_type: 'email' as 'email' | 'phone' | 'other',
    custom_message: '',
    max_responses: '1'
  });

  useEffect(() => {
    fetchInvitations();
  }, [campaign.id]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_invitations')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
        toast({
          title: "Error",
          description: "Failed to fetch invitations",
          variant: "destructive"
        });
      } else {
        setInvitations(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_invitations')
        .insert({
          campaign_id: campaign.id,
          contact_value: formData.contact_value,
          invitation_type: formData.invitation_type,
          custom_message: formData.custom_message || null,
          max_responses: parseInt(formData.max_responses),
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invitation:', error);
        toast({
          title: "Error",
          description: "Failed to create invitation",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Invitation created successfully"
        });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchInvitations();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUpdateInvitation = async () => {
    if (!editingInvitation) return;

    try {
      const { error } = await supabase
        .from('survey_invitations')
        .update({
          contact_value: formData.contact_value,
          invitation_type: formData.invitation_type,
          custom_message: formData.custom_message || null,
          max_responses: parseInt(formData.max_responses)
        })
        .eq('id', editingInvitation.id);

      if (error) {
        console.error('Error updating invitation:', error);
        toast({
          title: "Error",
          description: "Failed to update invitation",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Invitation updated successfully"
        });
        setEditingInvitation(null);
        resetForm();
        fetchInvitations();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to delete this invitation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('survey_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) {
        console.error('Error deleting invitation:', error);
        toast({
          title: "Error",
          description: "Failed to delete invitation",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Invitation deleted successfully"
        });
        fetchInvitations();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard"
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_value: '',
      invitation_type: 'email',
      custom_message: '',
      max_responses: '1'
    });
  };

  const openEditDialog = (invitation: SurveyInvitation) => {
    setEditingInvitation(invitation);
    setFormData({
      contact_value: invitation.contact_value || '',
      invitation_type: invitation.invitation_type as 'email' | 'phone' | 'other',
      custom_message: invitation.custom_message || '',
      max_responses: invitation.max_responses?.toString() || '1'
    });
  };

  const getShareableUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${campaign.campaign_uri}?invitation=${token}`;
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getContactLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'phone':
        return 'Phone';
      default:
        return 'Other';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Personal Invitations</h3>
          <p className="text-sm text-muted-foreground">
            Send personal invitations to specific individuals
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Send Invitation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Send Personal Invitation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invitation_type">Contact Type</Label>
                <Select
                  value={formData.invitation_type}
                  onValueChange={(value: 'email' | 'phone' | 'other') => 
                    setFormData({ ...formData, invitation_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <div className="flex items-center">
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="phone">
                      <div className="flex items-center">
                        <Phone className="mr-2 h-4 w-4" />
                        Phone Number
                      </div>
                    </SelectItem>
                    <SelectItem value="other">
                      <div className="flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        Other
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contact_value">
                  {getContactLabel(formData.invitation_type)}
                </Label>
                <Input
                  id="contact_value"
                  type={formData.invitation_type === 'email' ? 'email' : 'text'}
                  value={formData.contact_value}
                  onChange={(e) => setFormData({ ...formData, contact_value: e.target.value })}
                  placeholder={
                    formData.invitation_type === 'email' 
                      ? 'Enter email address' 
                      : formData.invitation_type === 'phone'
                      ? 'Enter phone number'
                      : 'Enter contact information'
                  }
                />
              </div>
              <div>
                <Label htmlFor="custom_message">Custom Message (Optional)</Label>
                <Textarea
                  id="custom_message"
                  value={formData.custom_message}
                  onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })}
                  placeholder="Add a personal message to include with the invitation"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="max_responses">Max Responses</Label>
                <Input
                  id="max_responses"
                  type="number"
                  min="1"
                  value={formData.max_responses}
                  onChange={(e) => setFormData({ ...formData, max_responses: e.target.value })}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Personal invitations typically allow only 1 response per invitation
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateInvitation}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Invitations Sent</h3>
          <p className="text-muted-foreground mb-4">
            Send personal invitations to start collecting responses
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Send First Invitation
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <Badge variant="secondary">
                      {getContactIcon(invitation.invitation_type)}
                      {getContactLabel(invitation.invitation_type)}
                    </Badge>
                    {invitation.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{invitation.contact_value}</span>
                    {invitation.custom_message && (
                      <span className="text-sm text-muted-foreground">
                        • {invitation.custom_message}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>Responses: {invitation.current_responses || 0}</span>
                    {invitation.max_responses && (
                      <span>/ {invitation.max_responses}</span>
                    )}
                    <span>• Created: {new Date(invitation.created_at!).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      value={getShareableUrl(invitation.unique_token)}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getShareableUrl(invitation.unique_token))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getShareableUrl(invitation.unique_token), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(invitation)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteInvitation(invitation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingInvitation} onOpenChange={() => setEditingInvitation(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Invitation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_invitation_type">Contact Type</Label>
              <Select
                value={formData.invitation_type}
                onValueChange={(value: 'email' | 'phone' | 'other') => 
                  setFormData({ ...formData, invitation_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="phone">
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4" />
                      Phone Number
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_contact_value">
                {getContactLabel(formData.invitation_type)}
              </Label>
              <Input
                id="edit_contact_value"
                type={formData.invitation_type === 'email' ? 'email' : 'text'}
                value={formData.contact_value}
                onChange={(e) => setFormData({ ...formData, contact_value: e.target.value })}
                placeholder={
                  formData.invitation_type === 'email' 
                    ? 'Enter email address' 
                    : formData.invitation_type === 'phone'
                    ? 'Enter phone number'
                    : 'Enter contact information'
                }
              />
            </div>
            <div>
              <Label htmlFor="edit_custom_message">Custom Message (Optional)</Label>
              <Textarea
                id="edit_custom_message"
                value={formData.custom_message}
                onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })}
                placeholder="Add a personal message to include with the invitation"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit_max_responses">Max Responses</Label>
              <Input
                id="edit_max_responses"
                type="number"
                min="1"
                value={formData.max_responses}
                onChange={(e) => setFormData({ ...formData, max_responses: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingInvitation(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateInvitation}>
                Update Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
