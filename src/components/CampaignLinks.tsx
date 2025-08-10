import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Link, Trash2, Plus, Eye } from 'lucide-react';

interface CampaignLink {
  id: string;
  name: string | null;
  description: string | null;
  unique_token: string;
  is_active: boolean;
  max_responses: number | null;
  current_responses: number;
  created_at: string;
  updated_at: string;
}

interface CampaignLinksProps {
  campaignId: number;
  campaignUri: string;
}

export const CampaignLinks: React.FC<CampaignLinksProps> = ({ campaignId, campaignUri }) => {
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { toast } = useToast();

  // Form state for creating new links
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_responses: '',
    is_active: true
  });

  const fetchLinks = async () => {
    try {
      const { data: linksData, error: linksError } = await supabase
        .from('campaign_links')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;
      setLinks(linksData || []);
    } catch (error) {
      console.error('Error fetching campaign links:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaign links',
        variant: 'destructive',
      });
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [campaignId]);

  const generateSurveyUrl = (token: string) => {
    return `${window.location.origin}/survey/${campaignUri}?token=${token}`;
  };

  const createLink = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a link name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: link, error } = await supabase
        .from('campaign_links')
        .insert({
          campaign_id: campaignId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          max_responses: formData.max_responses ? parseInt(formData.max_responses) : null,
          is_active: formData.is_active,
          link_type: 'generic'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Campaign link created successfully!',
      });

      // Reset form and refresh links
      setFormData({
        name: '',
        description: '',
        max_responses: '',
        is_active: true
      });
      setShowCreateForm(false);
      fetchLinks();
    } catch (error) {
      console.error('Error creating campaign link:', error);
      toast({
        title: 'Error',
        description: 'Failed to create campaign link',
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

  const deleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaign_links')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Campaign link deleted successfully',
      });

      fetchLinks();
    } catch (error) {
      console.error('Error deleting campaign link:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete campaign link',
        variant: 'destructive',
      });
    }
  };

  const toggleLinkStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('campaign_links')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Link ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      fetchLinks();
    } catch (error) {
      console.error('Error updating link status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update link status',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Generic Campaign Links
            </CardTitle>
            <p className="text-muted-foreground mt-1">
              Create and manage shared links for your campaign
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showCreateForm ? 'Cancel' : 'New Link'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Create Link Form */}
        {showCreateForm && (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg">Create New Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="link-name">Link Name *</Label>
                  <Input
                    id="link-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Social Media Link, Website Link"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-responses">Max Responses (Optional)</Label>
                  <Input
                    id="max-responses"
                    type="number"
                    value={formData.max_responses}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_responses: e.target.value }))}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-description">Description</Label>
                <Textarea
                  id="link-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this link"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is-active">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createLink}
                  disabled={loading || !formData.name.trim()}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  {loading ? 'Creating...' : 'Create Link'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Links List */}
        {loadingLinks ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading links...</p>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-8">
            <Link className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No links created yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first generic link to start sharing your survey
            </p>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-primary hover:opacity-90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <Card key={link.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{link.name}</h3>
                        <Badge variant={link.is_active ? "default" : "secondary"}>
                          {link.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {link.max_responses && (
                          <Badge variant="outline">
                            {link.current_responses}/{link.max_responses} responses
                          </Badge>
                        )}
                      </div>
                      {link.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {link.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Created: {new Date(link.created_at).toLocaleDateString()}</span>
                        <span>Responses: {link.current_responses}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generateSurveyUrl(link.unique_token))}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleLinkStatus(link.id, link.is_active)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {link.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteLink(link.id)}
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
