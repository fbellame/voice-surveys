import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Database, 
  Key, 
  Bell, 
  Shield,
  Save,
  TestTube
} from "lucide-react";

export default function Settings() {
  return (
    <Layout currentPage="settings">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your VoiceSurvey platform and integrations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supabase Integration */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-2">
                  <Database className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Supabase Integration</CardTitle>
                  <CardDescription>
                    Connect your Supabase project for backend functionality
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  📡 Backend Required
                </p>
                <p className="text-sm text-blue-700">
                  To enable authentication, database operations, and API endpoints, connect your Lovable project to Supabase using the green Supabase button in the top right.
                </p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="supabase-url">Supabase URL</Label>
                  <Input 
                    id="supabase-url" 
                    placeholder="https://your-project.supabase.co"
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="supabase-key">Anon Key</Label>
                  <Input 
                    id="supabase-key" 
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    type="password"
                    disabled
                    className="bg-muted"
                  />
                </div>
                <Button disabled className="w-full">
                  <Database className="mr-2 h-4 w-4" />
                  Connect Supabase First
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Configuration */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>API Configuration</CardTitle>
                  <CardDescription>
                    Configure API endpoints for call and answer webhooks
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="api-base">API Base URL</Label>
                  <Input 
                    id="api-base" 
                    placeholder="https://your-domain.com/api"
                    value="https://your-domain.com/api"
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="webhook-secret">Webhook Secret</Label>
                  <Input 
                    id="webhook-secret" 
                    placeholder="webhook_secret_key"
                    type="password"
                    className="bg-muted"
                    readOnly
                  />
                </div>
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  <p className="font-medium mb-1">Available Endpoints:</p>
                  <p>• POST /api/calls - Insert new call records</p>
                  <p>• POST /api/answers - Batch insert survey answers</p>
                </div>
                <Button variant="outline" className="w-full">
                  <TestTube className="mr-2 h-4 w-4" />
                  Test API Endpoints
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-yellow-100 p-2">
                  <Bell className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Configure email and system notifications
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>New Call Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new calls are received
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Campaign Status Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications for campaign lifecycle events
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Automated weekly summary emails
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2">
                  <Shield className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>
                    Authentication and access control settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="admin-email">Admin Email</Label>
                  <Input 
                    id="admin-email" 
                    type="email"
                    placeholder="admin@yourcompany.com"
                    defaultValue="admin@voicesurvey.demo"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div>
                    <p className="font-medium text-sm">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">
                      Enhanced security for admin accounts
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div>
                    <p className="font-medium text-sm">Session Timeout</p>
                    <p className="text-xs text-muted-foreground">
                      Auto-logout after 24 hours of inactivity
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </Layout>
  );
}