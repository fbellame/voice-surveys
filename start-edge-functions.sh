#!/bin/bash
# Script to start all Edge Functions locally

cd "$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Supabase Edge Functions...${NC}"
echo ""

# Check if Supabase is running
if ! supabase status > /dev/null 2>&1; then
    echo -e "${RED}Error: Supabase is not running.${NC}"
    echo "Please start Supabase first with: ${YELLOW}supabase start${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f "supabase/functions/.env" ]; then
    echo -e "${RED}Error: supabase/functions/.env file not found.${NC}"
    echo "Please create it with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY"
    exit 1
fi

# Check if OPENAI_API_KEY is configured
if grep -q "OPENAI_API_KEY=your-openai-key-here" supabase/functions/.env 2>/dev/null; then
    echo -e "${YELLOW}Warning: OPENAI_API_KEY is not configured in supabase/functions/.env${NC}"
    echo "Quiz generation will not work without a valid OpenAI API key."
    echo ""
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping Edge Functions...${NC}"
    kill $PID1 $PID2 $PID3 $PID4 $PID5 2>/dev/null
    wait $PID1 $PID2 $PID3 $PID4 $PID5 2>/dev/null
    echo -e "${GREEN}All Edge Functions stopped.${NC}"
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}Starting Edge Functions...${NC}"
echo ""

# Start each function in the background
echo -e "  ${YELLOW}→${NC} Starting process-pdf..."
supabase functions serve process-pdf --env-file supabase/functions/.env > /tmp/process-pdf.log 2>&1 &
PID1=$!

sleep 1

echo -e "  ${YELLOW}→${NC} Starting generate-quiz..."
supabase functions serve generate-quiz --env-file supabase/functions/.env > /tmp/generate-quiz.log 2>&1 &
PID2=$!

sleep 1

echo -e "  ${YELLOW}→${NC} Starting grade..."
supabase functions serve grade --env-file supabase/functions/.env > /tmp/grade.log 2>&1 &
PID3=$!

sleep 1

echo -e "  ${YELLOW}→${NC} Starting create-quiz-assignment..."
supabase functions serve create-quiz-assignment --env-file supabase/functions/.env > /tmp/create-quiz-assignment.log 2>&1 &
PID4=$!

sleep 1

echo -e "  ${YELLOW}→${NC} Starting create-quiz-link..."
supabase functions serve create-quiz-link --env-file supabase/functions/.env > /tmp/create-quiz-link.log 2>&1 &
PID5=$!

sleep 2

# Check if processes are still running
if ! kill -0 $PID1 2>/dev/null; then
    echo -e "${RED}Error: process-pdf failed to start${NC}"
    echo "Check logs: ${YELLOW}cat /tmp/process-pdf.log${NC}"
    cleanup
    exit 1
fi

if ! kill -0 $PID2 2>/dev/null; then
    echo -e "${RED}Error: generate-quiz failed to start${NC}"
    echo "Check logs: ${YELLOW}cat /tmp/generate-quiz.log${NC}"
    cleanup
    exit 1
fi

if ! kill -0 $PID3 2>/dev/null; then
    echo -e "${RED}Error: grade failed to start${NC}"
    echo "Check logs: ${YELLOW}cat /tmp/grade.log${NC}"
    cleanup
    exit 1
fi

if ! kill -0 $PID4 2>/dev/null; then
    echo -e "${RED}Error: create-quiz-assignment failed to start${NC}"
    echo "Check logs: ${YELLOW}cat /tmp/create-quiz-assignment.log${NC}"
    cleanup
    exit 1
fi

if ! kill -0 $PID5 2>/dev/null; then
    echo -e "${RED}Error: create-quiz-link failed to start${NC}"
    echo "Check logs: ${YELLOW}cat /tmp/create-quiz-link.log${NC}"
    cleanup
    exit 1
fi

echo ""
echo -e "${GREEN}✓ All Edge Functions started successfully!${NC}"
echo ""
echo "Functions running:"
echo -e "  ${GREEN}•${NC} process-pdf:            PID $PID1  → http://127.0.0.1:54321/functions/v1/process-pdf"
echo -e "  ${GREEN}•${NC} generate-quiz:           PID $PID2  → http://127.0.0.1:54321/functions/v1/generate-quiz"
echo -e "  ${GREEN}•${NC} grade:                   PID $PID3  → http://127.0.0.1:54321/functions/v1/grade"
echo -e "  ${GREEN}•${NC} create-quiz-assignment: PID $PID4  → http://127.0.0.1:54321/functions/v1/create-quiz-assignment"
echo -e "  ${GREEN}•${NC} create-quiz-link:       PID $PID5  → http://127.0.0.1:54321/functions/v1/create-quiz-link"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  - process-pdf:            tail -f /tmp/process-pdf.log"
echo "  - generate-quiz:          tail -f /tmp/generate-quiz.log"
echo "  - grade:                   tail -f /tmp/grade.log"
echo "  - create-quiz-assignment:  tail -f /tmp/create-quiz-assignment.log"
echo "  - create-quiz-link:        tail -f /tmp/create-quiz-link.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all functions${NC}"
echo ""

# Wait for all background processes
wait
