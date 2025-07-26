import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    // Redirect to login page by default
    window.location.href = "/login";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting to VoiceSurvey...</h1>
      </div>
    </div>
  );
};

export default Index;
