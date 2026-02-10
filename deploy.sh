#!/bin/bash

# Cellcard eSIM Exploitation Platform - Deployment Script
# This script handles deployment to staging and production environments

set -e

# Configuration
ENVIRONMENT=${1:-staging}
PROJECT_NAME="cellcard-esim-exploitation"
DOCKER_REGISTRY="your-registry.com"
DOCKER_IMAGE="${DOCKER_REGISTRY}/${PROJECT_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        staging|production)
            log "Deploying to $ENVIRONMENT environment"
            ;;
        *)
            error "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "docker-compose is not installed. Please install docker-compose first."
        exit 1
    fi

    # Check if .env file exists
    if [ ! -f ".env" ]; then
        error ".env file not found. Please copy .env.example to .env and configure your environment variables."
        exit 1
    fi

    log "Prerequisites check passed"
}

# Build Docker image
build_image() {
    log "Building Docker image..."

    # Get version from package.json
    VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')

    # Build image
    docker build -t "${DOCKER_IMAGE}:${VERSION}" -t "${DOCKER_IMAGE}:latest" .

    log "Docker image built successfully: ${DOCKER_IMAGE}:${VERSION}"
}

# Push image to registry (for production)
push_image() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Pushing image to registry..."

        VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')

        docker push "${DOCKER_IMAGE}:${VERSION}"
        docker push "${DOCKER_IMAGE}:latest"

        log "Image pushed to registry"
    fi
}

# Deploy using docker-compose
deploy_with_compose() {
    log "Deploying with docker-compose..."

    # Set environment file
    export COMPOSE_ENV_FILE=".env.${ENVIRONMENT}"

    # Create environment-specific env file if it doesn't exist
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        warn ".env.${ENVIRONMENT} not found. Using .env for ${ENVIRONMENT} deployment."
        cp .env ".env.${ENVIRONMENT}"
    fi

    # Stop existing containers
    docker-compose down || true

    # Start services
    docker-compose up -d

    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30

    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        log "Services are running successfully"
    else
        error "Some services failed to start"
        docker-compose logs
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."

    # Run the schema setup
    docker-compose exec -T postgres psql -U postgres -d cellcard_esim -f /docker-entrypoint-initdb.d/01-schema.sql || true

    log "Database migrations completed"
}

# Run health checks
health_check() {
    log "Running health checks..."

    # Wait for application to be ready
    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
            log "Application is healthy"
            return 0
        fi

        log "Waiting for application to be healthy (attempt $attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done

    error "Application failed health check after $max_attempts attempts"
    docker-compose logs app
    exit 1
}

# Run tests (for staging)
run_tests() {
    if [ "$ENVIRONMENT" = "staging" ]; then
        log "Running tests in staging..."

        # Build and run tests
        docker-compose exec app npm run test

        if [ $? -eq 0 ]; then
            log "Tests passed"
        else
            error "Tests failed"
            exit 1
        fi
    fi
}

# Cleanup
cleanup() {
    log "Cleaning up old images..."

    # Remove dangling images
    docker image prune -f || true

    log "Cleanup completed"
}

# Rollback function
rollback() {
    error "Deployment failed. Rolling back..."

    docker-compose down || true

    # Here you could implement rollback to previous version
    # For now, just log the failure

    log "Rollback completed. Please check the logs for errors."
}

# Main deployment function
main() {
    log "Starting deployment of $PROJECT_NAME to $ENVIRONMENT"

    validate_environment
    check_prerequisites

    # Trap for cleanup on error
    trap rollback ERR

    build_image
    push_image
    deploy_with_compose
    run_migrations
    run_tests
    health_check
    cleanup

    log "🎉 Deployment completed successfully!"
    log "Application is available at: http://localhost:3000"
    log "API Documentation: http://localhost:3000/api-docs"
    log "Test Interface: http://localhost:3000/index.html"
}

# Show usage
usage() {
    echo "Usage: $0 [staging|production]"
    echo ""
    echo "Deploy the Cellcard eSIM Exploitation Platform"
    echo ""
    echo "Arguments:"
    echo "  staging     Deploy to staging environment (default)"
    echo "  production  Deploy to production environment"
    echo ""
    echo "Environment variables:"
    echo "  Set your configuration in .env file"
    echo "  For production, ensure DOCKER_REGISTRY is set"
}

# Check arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "$@"
