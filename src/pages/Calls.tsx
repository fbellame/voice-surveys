import { useState } from "react";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Clock, 
  MessageSquare, 
  Play,
  X,
  ExternalLink,
  User
} from "lucide-react";

// Mock data - will be replaced with Supabase data
const mockCalls = [
  {
    id: 1,
    phone_number: "+15145859691",
    campaign_name: "InnoVet-AMR 2024",
    call_timestamp: "2025-07-26T17:20:47Z",
    s3_recording_url: null,
    answers: [
      {
        question: "What are your top three trends that are driving change in this space?",
        answer: "Wildfire, ice melting in Antarctica, destruction of community forest in Amazonia."
      },
      {
        question: "What are some of the biggest challenges and issues you are experiencing?",
        answer: "Quality of care in Montreal, heatwave in summer, quality of water in Montreal."
      },
      {
        question: "What new opportunities do you see to leverage innovation?",
        answer: "Use AI to better understand changes and tackle problems; modify government policy to account for those changes."
      }
    ]
  },
  {
    id: 2,
    phone_number: "+15145859691",
    campaign_name: "InnoVet-AMR 2024",
    call_timestamp: "2025-07-26T17:27:15Z",
    s3_recording_url: null,
    answers: [
      {
        question: "What are your top three trends that are driving change in this space?",
        answer: "Canadian wildfire, Arctic ice meltdown, Amazonian forest destruction."
      },
      {
        question: "What are some of the biggest challenges and issues you are experiencing?",
        answer: "Air‑quality issues in Montreal summers and overall water quality."
      },
      {
        question: "What new opportunities do you see to leverage innovation?",
        answer: "Apply AI to analyse change and adjust policy accordingly."
      }
    ]
  },
  {
    id: 3,
    phone_number: "+15145859691",
    campaign_name: "InnoVet-AMR 2024",
    call_timestamp: "2025-07-26T17:39:40Z",
    s3_recording_url: "s3://s3-photo-ai-saas/future_survey/20250726_133939_15145859691_call-_+15145859691_NCx7Lbnwwh5o.mp4",
    answers: [
      {
        question: "What are your top three trends that are driving change in this space?",
        answer: "Antarctic ice loss, Canadian wildfires, Amazon deforestation."
      },
      {
        question: "What are some of the biggest challenges and issues you are experiencing?",
        answer: "Montreal air‑quality and water‑quality concerns."
      },
      {
        question: "What new opportunities do you see to leverage innovation?",
        answer: "Leverage AI for insight and policy change."
      }
    ]
  }
];

export default function Calls() {
  const [calls] = useState(mockCalls);
  const [selectedCall, setSelectedCall] = useState<typeof mockCalls[0] | null>(null);

  const totalCalls = calls.length;
  const callsWithRecordings = calls.filter(c => c.s3_recording_url).length;
  const totalAnswers = calls.reduce((sum, c) => sum + c.answers.length, 0);
  const avgAnswersPerCall = Math.round(totalAnswers / totalCalls);

  return (
    <Layout currentPage="calls">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calls & Answers</h1>
            <p className="text-muted-foreground mt-2">
              Review survey responses and access call recordings
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Calls"
            value={totalCalls}
            icon={Phone}
            trend={{ value: 15, isPositive: true }}
          />
          <StatsCard
            title="With Recordings"
            value={callsWithRecordings}
            icon={Play}
          />
          <StatsCard
            title="Total Answers"
            value={totalAnswers}
            icon={MessageSquare}
            trend={{ value: 22, isPositive: true }}
          />
          <StatsCard
            title="Avg. Answers/Call"
            value={avgAnswersPerCall}
            icon={Clock}
          />
        </div>

        {/* Calls Table and Detail Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calls List */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
                <CardDescription>
                  Click on a call to view detailed answers and recordings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {calls.map((call) => (
                      <div
                        key={call.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedCall?.id === call.id 
                            ? "bg-accent border-primary shadow-sm" 
                            : "bg-card hover:bg-accent/50"
                        }`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-primary/10 p-2">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{call.phone_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {call.campaign_name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {new Date(call.call_timestamp).toLocaleDateString()}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {call.s3_recording_url && (
                                <Badge variant="secondary" className="text-xs">
                                  Recording
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {call.answers.length} answers
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Call Detail Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card shadow-card border-0 sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Call Details</CardTitle>
                  {selectedCall && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCall(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedCall ? (
                  <div className="space-y-6">
                    {/* Call Info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedCall.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(selectedCall.call_timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Campaign: {selectedCall.campaign_name}
                      </div>
                    </div>

                    {/* Recording */}
                    {selectedCall.s3_recording_url && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3">Recording</h4>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Recording
                          </Button>
                        </div>
                      </>
                    )}

                    {/* Answers */}
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-4">Survey Answers</h4>
                      <ScrollArea className="h-64">
                        <div className="space-y-4">
                          {selectedCall.answers.map((answer, index) => (
                            <div key={index} className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">
                                Q{index + 1}: {answer.question}
                              </p>
                              <p className="text-sm bg-muted p-3 rounded-md">
                                {answer.answer}
                              </p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Select a call to view details and survey responses
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}