import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Edit, Trash2, Plus, Link, Users, Mail, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CampaignLink = Database['public']['Tables']['campaign_links']['Row'];
type Campaign = Database['public']['Tables']['campaign']['Row'];

interface CampaignLinkManagerProps {
  campaign: Campaign;
  onRefresh?: () => void;
}

export function CampaignLinkManager({ campaign, onRefresh }: CampaignLinkManagerProps) {
  const { toast } = useToast();
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<CampaignLink | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    link_type: 'generic' as 'generic' | 'personal',
    max_responses: '',
    is_active: true
  });

  useEffect(() => {
    fetchLinks();
  }, [campaign.id]);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_links')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching links:', error);
        toast({
          title: "Error",
          description: "Failed to fetch campaign links",
          variant: "destructive"
        });
      } else {
        setLinks(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_links')
        .insert({
          campaign_id: campaign.id,
          name: formData.name || null,
          description: formData.description || null,
          link_type: formData.link_type,
          max_responses: formData.max_responses ? parseInt(formData.max_responses) : null,
          is_active: formData.is_active
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating link:', error);
        toast({
          title: "Error",
          description: "Failed to create campaign link",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Campaign link created successfully"
        });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchLinks();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUpdateLink = async () => {
    if (!editingLink) return;

    try {
      const { error } = await supabase
        .from('campaign_links')
        .update({
          name: formData.name || null,
          description: formData.description || null,
          link_type: formData.link_type,
          max_responses: formData.max_responses ? parseInt(formData.max_responses) : null,
          is_active: formData.is_active
        })
        .eq('id', editingLink.id);

      if (error) {
        console.error('Error updating link:', error);
        toast({
          title: "Error",
          description: "Failed to update campaign link",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Campaign link updated successfully"
        });
        setEditingLink(null);
        resetForm();
        fetchLinks();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaign_links')
        .delete()
        .eq('id', linkId);

      if (error) {
        console.error('Error deleting link:', error);
        toast({
          title: "Error",
          description: "Failed to delete campaign link",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Campaign link deleted successfully"
        });
        fetchLinks();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleToggleActive = async (link: CampaignLink) => {
    try {
      const { error } = await supabase
        .from('campaign_links')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);

      if (error) {
        console.error('Error toggling link:', error);
        toast({
          title: "Error",
          description: "Failed to update link status",
          variant: "destructive"
        });
      } else {
        fetchLinks();
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
      name: '',
      description: '',
      link_type: 'generic',
      max_responses: '',
      is_active: true
    });
  };

  const openEditDialog = (link: CampaignLink) => {
    setEditingLink(link);
    setFormData({
      name: link.name || '',
      description: link.description || '',
      link_type: link.link_type as 'generic' | 'personal',
      max_responses: link.max_responses?.toString() || '',
      is_active: link.is_active
    });
  };

  const getShareableUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${campaign.campaign_uri}?link=${token}`;
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
          <h3 className="text-lg font-semibold">Campaign Links</h3>
          <p className="text-sm text-muted-foreground">
            Manage shared links for this campaign
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Campaign Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Link Name (Optional)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Marketing Team, Sales Team"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this link's purpose"
                />
              </div>
              <div>
                <Label htmlFor="link_type">Link Type</Label>
                <Select
                  value={formData.link_type}
                  onValueChange={(value: 'generic' | 'personal') => 
                    setFormData({ ...formData, link_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">
                      <div className="flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        Generic (Multiple responses allowed)
                      </div>
                    </SelectItem>
                    <SelectItem value="personal">
                      <div className="flex items-center">
                        <Mail className="mr-2 h-4 w-4" />
                        Personal (One response per link)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="max_responses">Max Responses (Optional)</Label>
                <Input
                  id="max_responses"
                  type="number"
                  value={formData.max_responses}
                  onChange={(e) => setFormData({ ...formData, max_responses: e.target.value })}
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateLink}>
                  Create Link
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {links.length === 0 ? (
        <Card className="p-8 text-center">
          <Link className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Links Created</h3>
          <p className="text-muted-foreground mb-4">
            Create your first campaign link to start sharing this survey
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Link
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <Card key={link.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <Badge variant={link.link_type === 'generic' ? 'default' : 'secondary'}>
                      {link.link_type === 'generic' ? (
                        <>
                          <Users className="mr-1 h-3 w-3" />
                          Generic
                        </>
                      ) : (
                        <>
                          <Mail className="mr-1 h-3 w-3" />
                          Personal
                        </>
                      )}
                    </Badge>
                    {link.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  
                  {link.name && (
                    <h4 className="font-medium">{link.name}</h4>
                  )}
                  
                  {link.description && (
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>Responses: {link.current_responses}</span>
                    {link.max_responses && (
                      <span>/ {link.max_responses}</span>
                    )}
                    <span>• Created: {new Date(link.created_at!).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      value={getShareableUrl(link.unique_token)}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getShareableUrl(link.unique_token))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getShareableUrl(link.unique_token), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Switch
                    checked={link.is_active}
                    onCheckedChange={() => handleToggleActive(link)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(link)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteLink(link.id)}
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
      <Dialog open={!!editingLink} onOpenChange={() => setEditingLink(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Campaign Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Link Name (Optional)</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Marketing Team, Sales Team"
              />
            </div>
            <div>
              <Label htmlFor="edit_description">Description (Optional)</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this link's purpose"
              />
            </div>
            <div>
              <Label htmlFor="edit_link_type">Link Type</Label>
              <Select
                value={formData.link_type}
                onValueChange={(value: 'generic' | 'personal') => 
                  setFormData({ ...formData, link_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      Generic (Multiple responses allowed)
                    </div>
                  </SelectItem>
                  <SelectItem value="personal">
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4" />
                      Personal (One response per link)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_max_responses">Max Responses (Optional)</Label>
              <Input
                id="edit_max_responses"
                type="number"
                value={formData.max_responses}
                onChange={(e) => setFormData({ ...formData, max_responses: e.target.value })}
                placeholder="Leave empty for unlimited"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit_is_active">Active</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingLink(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLink}>
                Update Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
