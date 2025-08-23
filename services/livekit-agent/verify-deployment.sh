#!/bin/bash

# LiveKit Agent + DataDog Deployment Verification Script
# This script verifies that all components are properly set up and working

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Verify Docker installation
verify_docker() {
    log_info "Verifying Docker installation..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed"
        return 1
    fi
    
    if ! systemctl is-active --quiet docker; then
        log_error "Docker service is not running"
        return 1
    fi
    
    log_success "Docker is installed and running"
    return 0
}

# Verify Docker Compose installation
verify_docker_compose() {
    log_info "Verifying Docker Compose installation..."
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed"
        return 1
    fi
    
    log_success "Docker Compose is installed"
    return 0
}

# Verify environment files
verify_env_files() {
    log_info "Verifying environment files..."
    
    local missing_files=()
    
    if [[ ! -f /etc/livekit-agent.env ]]; then
        missing_files+=("/etc/livekit-agent.env")
    fi
    
    if [[ ! -f /etc/datadog.env ]]; then
        missing_files+=("/etc/datadog.env")
    fi
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_error "Missing environment files: ${missing_files[*]}"
        return 1
    fi
    
    # Check if DD_API_KEY is set in datadog.env
    if ! grep -q "^DD_API_KEY=" /etc/datadog.env; then
        log_error "DD_API_KEY not found in /etc/datadog.env"
        return 1
    fi
    
    # Check if DOCKER_IMAGE is set in livekit-agent.env
    if ! grep -q "^DOCKER_IMAGE=" /etc/livekit-agent.env; then
        log_error "DOCKER_IMAGE not found in /etc/livekit-agent.env"
        return 1
    fi
    
    log_success "Environment files are properly configured"
    return 0
}

# Verify systemd service
verify_systemd_service() {
    log_info "Verifying systemd service..."
    
    if [[ ! -f /etc/systemd/system/livekit-agent-compose@.service ]]; then
        log_error "Systemd service file not found"
        return 1
    fi
    
    if ! systemctl is-enabled livekit-agent-compose@1 >/dev/null 2>&1; then
        log_warning "Service is not enabled (run: systemctl enable livekit-agent-compose@1)"
    fi
    
    log_success "Systemd service is configured"
    return 0
}

# Verify Docker network
verify_docker_network() {
    log_info "Verifying Docker monitoring network..."
    
    if ! docker network ls | grep -q monitoring; then
        log_error "Monitoring network not found"
        return 1
    fi
    
    log_success "Monitoring network exists"
    return 0
}

# Verify application directory
verify_app_directory() {
    log_info "Verifying application directory..."
    
    if [[ ! -d /opt/livekit-agent ]]; then
        log_error "Application directory /opt/livekit-agent not found"
        return 1
    fi
    
    if [[ ! -f /opt/livekit-agent/docker-compose.yml ]]; then
        log_error "Docker Compose file not found"
        return 1
    fi
    
    log_success "Application directory is properly set up"
    return 0
}

# Verify containers are running
verify_containers() {
    log_info "Verifying containers are running..."
    
    local containers=("livekit-agent-1" "dd-agent")
    local missing_containers=()
    
    for container in "${containers[@]}"; do
        if ! docker ps --format "table {{.Names}}" | grep -q "^${container}$"; then
            missing_containers+=("$container")
        fi
    done
    
    if [[ ${#missing_containers[@]} -gt 0 ]]; then
        log_error "Missing running containers: ${missing_containers[*]}"
        return 1
    fi
    
    log_success "All containers are running"
    return 0
}

# Verify container health
verify_container_health() {
    log_info "Verifying container health..."
    
    # Check LiveKit agent health
    if ! docker inspect livekit-agent-1 | grep -q '"Status": "healthy"'; then
        log_warning "LiveKit agent container is not healthy"
    else
        log_success "LiveKit agent container is healthy"
    fi
    
    # Check DataDog agent status
    if docker exec dd-agent agent status >/dev/null 2>&1; then
        log_success "DataDog agent is responding"
    else
        log_warning "DataDog agent status check failed"
    fi
}

# Verify ports are accessible
verify_ports() {
    log_info "Verifying ports are accessible..."
    
    # Check LiveKit agent port
    if netstat -tlnp | grep -q ":8081 "; then
        log_success "LiveKit agent port 8081 is listening"
    else
        log_warning "LiveKit agent port 8081 is not listening"
    fi
    
    # Check health check port
    if netstat -tlnp | grep -q ":8080 "; then
        log_success "Health check port 8080 is listening"
    else
        log_warning "Health check port 8080 is not listening"
    fi
}

# Verify DataDog connectivity
verify_datadog_connectivity() {
    log_info "Verifying DataDog connectivity..."
    
    # Check if DataDog agent can reach DataDog cloud
    if docker exec dd-agent agent status | grep -q "Agent Health: PASS"; then
        log_success "DataDog agent is healthy and connected"
    else
        log_warning "DataDog agent health check failed"
    fi
}

# Verify service logs
verify_service_logs() {
    log_info "Verifying service logs..."
    
    # Check systemd service logs
    if journalctl -u livekit-agent-compose@1 --no-pager -n 1 >/dev/null 2>&1; then
        log_success "Systemd service logs are accessible"
    else
        log_warning "Systemd service logs not accessible"
    fi
    
    # Check container logs
    if docker logs --tail=1 livekit-agent-1 >/dev/null 2>&1; then
        log_success "LiveKit agent container logs are accessible"
    else
        log_warning "LiveKit agent container logs not accessible"
    fi
    
    if docker logs --tail=1 dd-agent >/dev/null 2>&1; then
        log_success "DataDog agent container logs are accessible"
    else
        log_warning "DataDog agent container logs not accessible"
    fi
}

# Display deployment status
display_status() {
    log_info "=== Deployment Status Summary ==="
    echo
    
    echo "📋 Environment Files:"
    ls -la /etc/livekit-agent.env /etc/datadog.env 2>/dev/null || echo "❌ Missing environment files"
    echo
    
    echo "🐳 Docker Status:"
    systemctl status docker --no-pager -l || echo "❌ Docker not running"
    echo
    
    echo "📦 Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(livekit-agent|dd-agent)" || echo "❌ No containers running"
    echo
    
    echo "🌐 Network Status:"
    docker network ls | grep monitoring || echo "❌ Monitoring network not found"
    echo
    
    echo "⚙️  Systemd Service Status:"
    systemctl status livekit-agent-compose@1 --no-pager -l || echo "❌ Service not running"
    echo
    
    echo "📊 DataDog Agent Status:"
    docker exec dd-agent agent status 2>/dev/null || echo "❌ DataDog agent not responding"
    echo
    
    echo "🔍 Port Status:"
    netstat -tlnp | grep -E ":(8080|8081) " || echo "❌ Ports not listening"
    echo
}

# Main verification function
main() {
    log_info "Starting LiveKit Agent + DataDog deployment verification..."
    echo
    
    local failed_checks=0
    
    # Run all verification checks
    verify_docker || ((failed_checks++))
    verify_docker_compose || ((failed_checks++))
    verify_env_files || ((failed_checks++))
    verify_systemd_service || ((failed_checks++))
    verify_docker_network || ((failed_checks++))
    verify_app_directory || ((failed_checks++))
    verify_containers || ((failed_checks++))
    verify_container_health
    verify_ports
    verify_datadog_connectivity
    verify_service_logs
    
    echo
    display_status
    
    if [[ $failed_checks -eq 0 ]]; then
        log_success "✅ All critical checks passed! Deployment is working correctly."
        echo
        echo "🎉 Your LiveKit Agent with DataDog monitoring is ready!"
        echo
        echo "📈 Next steps:"
        echo "1. Check your DataDog dashboard for metrics and APM traces"
        echo "2. Monitor logs: journalctl -u livekit-agent-compose@1 -f"
        echo "3. Check container logs: docker logs -f livekit-agent-1"
        echo "4. Verify DataDog agent: docker logs -f dd-agent"
    else
        log_error "❌ $failed_checks critical check(s) failed. Please review the errors above."
        echo
        echo "🔧 Troubleshooting tips:"
        echo "1. Check environment files: /etc/livekit-agent.env and /etc/datadog.env"
        echo "2. Restart the service: systemctl restart livekit-agent-compose@1"
        echo "3. Check logs: journalctl -u livekit-agent-compose@1 -f"
        echo "4. Verify Docker: systemctl status docker"
        exit 1
    fi
}

# Run main function
main "$@"
