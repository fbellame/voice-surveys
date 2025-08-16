FROM python:3.11-slim
WORKDIR /app
COPY services/livekit-agent/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/livekit-agent/ ./
CMD ["python", "main.py", "start"]
