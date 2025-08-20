# syntax=docker/dockerfile:1.7

# This is an example Dockerfile that builds a minimal container for running LK Agents
# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.10.13
FROM python:${PYTHON_VERSION}-slim

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1

# Create a non-privileged user that the app will run under.
# See https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/home/appuser" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser


# Install gcc and other build dependencies.
RUN apt-get update && \
    apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

USER appuser

RUN mkdir -p /home/appuser/.cache
RUN chown -R appuser /home/appuser/.cache

WORKDIR /home/appuser

# Copy requirements.txt from the correct path (build context is repository root)
COPY services/livekit-agent/requirements.txt .
RUN python -m pip install --user --no-cache-dir -r requirements.txt

# Note: Removed shared packages dependency - types are now self-contained

# Copy the livekit agent service files
COPY services/livekit-agent/ .

# Create a temporary .env file for build-time operations
RUN echo "DEEPGRAM_API_KEY=placeholder_for_build" > .env && \
    echo "OPENAI_API_KEY=placeholder_for_build" >> .env && \
    echo "LIVEKIT_URL=placeholder_for_build" >> .env && \
    echo "LIVEKIT_API_KEY=placeholder_for_build" >> .env && \
    echo "LIVEKIT_API_SECRET=placeholder_for_build" >> .env && \
    echo "AWS_ACCESS_KEY_ID=placeholder_for_build" >> .env && \
    echo "AWS_SECRET_ACCESS_KEY=placeholder_for_build" >> .env && \
    echo "AWS_REGION=placeholder_for_build" >> .env && \
    echo "SUPABASE_URL=placeholder_for_build" >> .env && \
    echo "SUPABASE_KEY=placeholder_for_build" >> .env

# Try the download, but do NOT fail the build if it complains about Supabase
RUN python main.py download-files || echo "Skipping download-files during build (no Supabase)."

# Clean up so the runtime isn't confused by a blank .env
RUN rm -f .env


# expose healthcheck port
EXPOSE 8081

# Run the application.
CMD ["python", "main.py", "start"]
