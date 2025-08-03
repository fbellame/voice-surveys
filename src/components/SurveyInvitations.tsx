import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, QrCode, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';

interface SurveyInvitation {
  id: string;
  email: string;
  unique_token: string;
  qr_code_url: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

interface SurveyInvitationsProps {
  campaignId: number;
  campaignUri: string;
}

export const SurveyInvitations: React.FC<SurveyInvitationsProps> = ({ campaignId, campaignUri }) => {
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const { toast } = useToast();

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_invitations')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
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
    return `${window.location.origin}/survey/${campaignUri}?token=${token}`;
  };

  const generateQRCode = async (url: string): Promise<string> => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  };

  const createInvitation = async () => {
    if (!email.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create the invitation record
      const { data: invitation, error } = await supabase
        .from('survey_invitations')
        .insert({
          campaign_id: campaignId,
          email: email.trim(),
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

      setEmail('');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new invitation */}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createInvitation()}
          />
          <Button onClick={createInvitation} disabled={loading}>
            {loading ? 'Creating...' : 'Create Invitation'}
          </Button>
        </div>

        {/* Invitations list */}
        {loadingInvitations ? (
          <div>Loading invitations...</div>
        ) : (
          <div className="space-y-3">
            {invitations.length === 0 ? (
              <p className="text-muted-foreground">No invitations created yet.</p>
            ) : (
              invitations.map((invitation) => {
                const surveyUrl = generateSurveyUrl(invitation.unique_token);
                return (
                  <Card key={invitation.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span className="font-medium">{invitation.email}</span>
                          {invitation.responded_at && (
                            <Badge variant="secondary">Responded</Badge>
                          )}
                          {invitation.sent_at && !invitation.responded_at && (
                            <Badge variant="outline">Sent</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {new Date(invitation.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            {surveyUrl}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(surveyUrl)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {invitation.qr_code_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = invitation.qr_code_url!;
                              link.download = `qr-${invitation.email}.png`;
                              link.click();
                            }}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteInvitation(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {invitation.qr_code_url && (
                      <div className="mt-3 pt-3 border-t">
                        <img
                          src={invitation.qr_code_url}
                          alt="QR Code"
                          className="w-32 h-32 border rounded"
                        />
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};