import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, QrCode, Trash2, Phone, User } from 'lucide-react';
import QRCode from 'qrcode';

interface SurveyInvitation {
  id: string;
  invitation_type: 'email' | 'phone' | 'other';
  contact_value: string;
  unique_token: string;
  qr_code_url: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
  hasSubmission?: boolean;
  submissionDate?: string;
}

interface SurveyInvitationsProps {
  campaignId: number;
  campaignUri: string;
}

export const SurveyInvitations: React.FC<SurveyInvitationsProps> = ({ campaignId, campaignUri }) => {
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([]);
  const [invitationType, setInvitationType] = useState<'email' | 'phone' | 'other'>('email');
  const [contactValue, setContactValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const { toast } = useToast();

  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      // Fetch invitations with fresh data
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('survey_invitations')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (invitationsError) throw invitationsError;

      // Fetch user profiles for this campaign to verify completion
      const { data: userProfilesData, error: userProfilesError } = await supabase
        .from('user_profiles')
        .select('link_token, created_at, full_name')
        .eq('campaign_id', campaignId)
        .eq('link_type', 'personal');

      if (userProfilesError) throw userProfilesError;

      console.log('Debug SurveyInvitations - Invitations:', invitationsData?.length);
      console.log('Debug SurveyInvitations - User Profiles:', userProfilesData?.length);

      // Enhance invitations with user profile status
      const enhancedInvitations = (invitationsData || []).map(invitation => {
        const userProfile = (userProfilesData || []).find(
          up => up.link_token === invitation.unique_token
        );
        
        const enhanced = {
          ...invitation,
          hasSubmission: !!userProfile,
          submissionDate: userProfile?.created_at || null
        };

        console.log(`Debug - ${invitation.contact_value}: responded_at=${invitation.responded_at}, hasSubmission=${enhanced.hasSubmission}`);
        
        return enhanced;
      });

      setInvitations(enhancedInvitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load survey invitations',
        variant: 'destructive',
      });
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [campaignId]);

  const generateSurveyUrl = (token: string) => {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalDev ? window.location.origin : 'https://survey.generative-ai.ca';
    return `${baseUrl}/survey/${campaignUri}?token=${token}`;
  };

  const generateQRCode = async (url: string): Promise<string> => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const createInvitation = async () => {
    if (!contactValue.trim()) {
      toast({
        title: 'Error',
        description: `Please enter a ${invitationType}`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create the invitation record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: invitation, error } = await supabase
        .from('survey_invitations')
        .insert({
          campaign_id: campaignId,
          invitation_type: invitationType,
          contact_value: contactValue.trim(),
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate QR code
      const surveyUrl = generateSurveyUrl(invitation.unique_token);
      const qrCodeDataURL = await generateQRCode(surveyUrl);

      // Update the invitation with QR code URL
      const { error: updateError } = await supabase
        .from('survey_invitations')
        .update({ qr_code_url: qrCodeDataURL })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Survey invitation created successfully!',
      });

      setContactValue('');
      fetchInvitations();
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create survey invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Link copied to clipboard',
    });
  };

  const deleteInvitation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invitation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('survey_invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invitation deleted successfully',
      });

      fetchInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete invitation',
        variant: 'destructive',
      });
    }
  };

  const getInvitationTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getInvitationTypeLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'phone':
        return 'Phone';
      default:
        return 'Other';
    }
  };

  const getContactPlaceholder = () => {
    switch (invitationType) {
      case 'email':
        return 'Enter email address';
      case 'phone':
        return 'Enter phone number';
      default:
        return 'Enter contact information';
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Personal Invitations
        </CardTitle>
        <p className="text-muted-foreground mt-1">
          Create individual invitations for specific users
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Create Invitation Form */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Create New Invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invitation-type">Invitation Type</Label>
                <Select
                  value={invitationType}
                  onValueChange={(value: 'email' | 'phone' | 'other') => setInvitationType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-value">{getInvitationTypeLabel(invitationType)} *</Label>
                <Input
                  id="contact-value"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={getContactPlaceholder()}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={createInvitation}
                disabled={loading || !contactValue.trim()}
                className="bg-gradient-primary hover:opacity-90"
              >
                {loading ? 'Creating...' : 'Create Invitation'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invitations List */}
        {loadingInvitations ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading invitations...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No invitations created yet</h3>
            <p className="text-muted-foreground">
              Create your first invitation to start collecting responses
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <Card key={invitation.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getInvitationTypeIcon(invitation.invitation_type)}
                        <span className="font-semibold">{invitation.contact_value}</span>
                        <Badge variant="outline">
                          {getInvitationTypeLabel(invitation.invitation_type)}
                        </Badge>
                        {invitation.hasSubmission && (
                          <Badge variant="default" className="bg-green-500">
                            Completed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Created: {new Date(invitation.created_at).toLocaleDateString()}</span>
                        {invitation.sent_at && (
                          <span>Sent: {new Date(invitation.sent_at).toLocaleDateString()}</span>
                        )}
                        {invitation.responded_at && (
                          <span>Responded: {new Date(invitation.responded_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generateSurveyUrl(invitation.unique_token))}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                      {invitation.qr_code_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newWindow = window.open();
                            if (newWindow) {
                              newWindow.document.write(`
                                <html>
                                  <head><title>QR Code - ${invitation.contact_value}</title></head>
                                  <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                                    <img src="${invitation.qr_code_url}" alt="QR Code" style="max-width: 100%; height: auto;" />
                                  </body>
                                </html>
                              `);
                            }
                          }}
                        >
                          <QrCode className="h-4 w-4 mr-1" />
                          QR Code
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteInvitation(invitation.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};