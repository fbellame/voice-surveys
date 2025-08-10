// Helper function to format question with context
export const formatQuestionWithContext = (question: string, context: string): string => {
  if (!context.trim()) return question;
  return `[CONTEXT:${context.trim()}]${question}`;
};

// Helper function to parse question and context
export const parseQuestionAndContext = (formattedQuestion: string): { question: string; context: string } => {
  const contextMatch = formattedQuestion.match(/^\[CONTEXT:(.*?)\](.*)$/);
  if (contextMatch) {
    return {
      context: contextMatch[1],
      question: contextMatch[2]
    };
  }
  return {
    context: "",
    question: formattedQuestion
  };
};

// Helper function to display question with context for users
export const displayQuestionWithContext = (formattedQuestion: string): { question: string; context?: string } => {
  const { question, context } = parseQuestionAndContext(formattedQuestion);
  return {
    question,
    context: context || undefined
  };
};

// Helper function to get just the question text without context
export const getQuestionTextOnly = (formattedQuestion: string): string => {
  return parseQuestionAndContext(formattedQuestion).question;
};

// Helper function to get just the context
export const getQuestionContextOnly = (formattedQuestion: string): string => {
  return parseQuestionAndContext(formattedQuestion).context;
};
