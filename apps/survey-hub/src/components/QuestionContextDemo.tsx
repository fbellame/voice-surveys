import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatQuestionWithContext, parseQuestionAndContext, displayQuestionWithContext } from "@/lib/questionUtils";

export function QuestionContextDemo() {
  const [question, setQuestion] = useState("What is your favorite color?");
  const [context, setContext] = useState("This question helps us understand color preferences for our product design.");
  const [formattedQuestion, setFormattedQuestion] = useState("");

  const handleFormat = () => {
    const formatted = formatQuestionWithContext(question, context);
    setFormattedQuestion(formatted);
  };

  const handleParse = () => {
    if (formattedQuestion) {
      const parsed = parseQuestionAndContext(formattedQuestion);
      setQuestion(parsed.question);
      setContext(parsed.context);
    }
  };

  const handleDisplay = () => {
    if (formattedQuestion) {
      const display = displayQuestionWithContext(formattedQuestion);
      console.log("Display result:", display);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Question Context Demo</CardTitle>
        <CardDescription>
          This demo shows how the question context feature works. You can add context to questions
          that will be stored in the database and displayed to users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question">Question</Label>
          <Input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="context">Context (Optional)</Label>
          <Textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Provide context to help explain this question..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            This context will be stored with the question and displayed to users
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleFormat} variant="outline">
            Format Question
          </Button>
          <Button onClick={handleParse} variant="outline" disabled={!formattedQuestion}>
            Parse Question
          </Button>
          <Button onClick={handleDisplay} variant="outline" disabled={!formattedQuestion}>
            Display Question
          </Button>
        </div>

        {formattedQuestion && (
          <div className="space-y-2">
            <Label>Formatted Question (Database Storage)</Label>
            <div className="p-3 bg-muted rounded-md text-sm font-mono">
              {formattedQuestion}
            </div>
            <p className="text-xs text-muted-foreground">
              This is how the question is stored in the database with context
            </p>
          </div>
        )}

        {formattedQuestion && (
          <div className="space-y-2">
            <Label>Displayed to Users</Label>
            <div className="p-3 border rounded-md">
              {(() => {
                const { question: displayQuestion, context: displayContext } = displayQuestionWithContext(formattedQuestion);
                return (
                  <>
                    <p className="font-medium">{displayQuestion}</p>
                    {displayContext && (
                      <p className="text-sm text-muted-foreground mt-1 italic">
                        Context: {displayContext}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <p className="text-xs text-muted-foreground">
              This is how the question appears to users with context
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
