import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AudioRoom } from '@/components/audio/AudioRoom';
import { SimpleSurvey } from '@/components/audio/SimpleSurvey';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Headphones, Users, Mic, Zap, Bot, ArrowRight, Loader2, LogOut } from 'lucide-react';
import type { User, Session } from '@supabase/supabase-js';

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  campaign_uri: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'home' | 'room' | 'survey'>('home');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate('/auth');
      } else {
        // Only fetch campaigns if user is authenticated
        setTimeout(() => {
          fetchCampaigns();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign')
        .select('id, name, description, campaign_uri')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching campaigns:', error);
      } else {
        setCampaigns(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickJoin = () => {
    const params = new URLSearchParams({
      room: roomName || 'demo-room',
      user: userName || `User-${Math.floor(Math.random() * 1000)}`,
      autoJoin: 'true'
    });
    navigate(`/room?${params.toString()}`);
  };

  const handleStartSurvey = (campaign: Campaign) => {
    // Use the campaign_uri directly for navigation
    navigate(`/${campaign.campaign_uri}`);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Sign Out Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out."
      });
    }
  };

  if (currentView === 'room') {
    return <AudioRoom onLeave={() => setCurrentView('home')} />;
  }

  if (currentView === 'survey') {
    return <SimpleSurvey 
      campaign={selectedCampaign} 
      onComplete={() => {
        setCurrentView('home');
        setSelectedCampaign(null);
      }} 
    />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5" />
        <div className="relative max-w-6xl mx-auto px-4 py-12">
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1 text-center">
              <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6 shadow-glow">
                <Bot className="h-8 w-8 text-white" />
              </div>
              
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Future Surveys
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Select a survey below to begin your AI-powered conversation
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading surveys...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="p-8 text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Surveys Available</h3>
            <p className="text-muted-foreground">
              There are currently no surveys configured. Please check back later.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="p-6 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="text-muted-foreground text-sm mb-4">
                        {campaign.description}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleStartSurvey(campaign)}
                    variant="audio"
                    size="lg"
                    className="ml-6"
                  >
                    <Bot className="mr-2 h-5 w-5" />
                    Start Survey
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Index;
