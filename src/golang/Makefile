# IPF Extractor Build Makefile

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Binary names
BINARY_NAME=ipf-extractor
BINARY_UNIX=$(BINARY_NAME)_unix

# Build flags
LDFLAGS=-ldflags "-s -w -X main.AppVersion=$(shell date -u +'%Y-%m-%d_%H:%M:%S')"

# Directories
BUILD_DIR=build
DIST_DIR=dist

# Default target
.PHONY: all
all: clean deps test build

# Install dependencies
.PHONY: deps
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Run tests
.PHONY: test
test:
	$(GOTEST) -v ./...

# Run tests with coverage
.PHONY: test-coverage
test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Build for current platform
.PHONY: build
build:
	@echo "Building for $(GOOS)/$(GOARCH)..."
	mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/ipf-extractor

# Build for all platforms
.PHONY: build-all
build-all: clean deps build-linux build-windows build-darwin

# Build for Linux (amd64)
.PHONY: build-linux
build-linux:
	@echo "Building for Linux amd64..."
	mkdir -p $(DIST_DIR)/linux-amd64
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/linux-amd64/$(BINARY_NAME) ./cmd/ipf-extractor

# Build for Linux (arm64)
.PHONY: build-linux-arm64
build-linux-arm64:
	@echo "Building for Linux arm64..."
	mkdir -p $(DIST_DIR)/linux-arm64
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/linux-arm64/$(BINARY_NAME) ./cmd/ipf-extractor

# Build for Windows (amd64)
.PHONY: build-windows
build-windows:
	@echo "Building for Windows amd64..."
	mkdir -p $(DIST_DIR)/windows-amd64
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/windows-amd64/$(BINARY_NAME).exe ./cmd/ipf-extractor

# Build for Windows (arm64)
.PHONY: build-windows-arm64
build-windows-arm64:
	@echo "Building for Windows arm64..."
	mkdir -p $(DIST_DIR)/windows-arm64
	CGO_ENABLED=0 GOOS=windows GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/windows-arm64/$(BINARY_NAME).exe ./cmd/ipf-extractor

# Build for macOS (amd64)
.PHONY: build-darwin
build-darwin:
	@echo "Building for macOS amd64..."
	mkdir -p $(DIST_DIR)/darwin-amd64
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/darwin-amd64/$(BINARY_NAME) ./cmd/ipf-extractor

# Build for macOS (arm64)
.PHONY: build-darwin-arm64
build-darwin-arm64:
	@echo "Building for macOS arm64..."
	mkdir -p $(DIST_DIR)/darwin-arm64
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/darwin-arm64/$(BINARY_NAME) ./cmd/ipf-extractor

# Build release versions
.PHONY: release
release: clean deps test build-linux build-linux-arm64 build-windows build-windows-arm64 build-darwin build-darwin-arm64
	@echo "Creating release packages..."
	cd $(DIST_DIR) && for dir in */; do \
		platform=$${dir%/}; \
		if [[ $$platform == windows* ]]; then \
			zip -r $$platform.zip $$dir; \
		else \
			tar -czf $$platform.tar.gz $$dir; \
		fi; \
	done
	@echo "Release packages created in $(DIST_DIR)"

# Development build with debug info
.PHONY: dev
dev:
	mkdir -p $(BUILD_DIR)
	$(GOBUILD) -race -o $(BUILD_DIR)/$(BINARY_NAME)-dev ./cmd/ipf-extractor

# Run with development build
.PHONY: run
run: dev
	./$(BUILD_DIR)/$(BINARY_NAME)-dev

# Benchmark
.PHONY: bench
bench:
	$(GOTEST) -bench=. -benchmem ./...

# Profile
.PHONY: profile
profile:
	mkdir -p $(BUILD_DIR)
	$(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-profile ./cmd/ipf-extractor
	./$(BUILD_DIR)/$(BINARY_NAME)-profile -cpuprofile=$(BUILD_DIR)/cpu.prof -memprofile=$(BUILD_DIR)/mem.prof

# Clean build artifacts
.PHONY: clean
clean:
	$(GOCLEAN)
	rm -rf $(BUILD_DIR)
	rm -rf $(DIST_DIR)
	rm -f coverage.out coverage.html

# Format code
.PHONY: fmt
fmt:
	$(GOCMD) fmt ./...

# Lint code
.PHONY: lint
lint:
	golangci-lint run

# Vet code
.PHONY: vet
vet:
	$(GOCMD) vet ./...

# Security check
.PHONY: security
security:
	gosec ./...

# Install locally
.PHONY: install
install: build
	cp $(BUILD_DIR)/$(BINARY_NAME) $(GOPATH)/bin/

# Uninstall locally
.PHONY: uninstall
uninstall:
	rm -f $(GOPATH)/bin/$(BINARY_NAME)

# Show help
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  all              - Clean, deps, test, and build"
	@echo "  deps             - Download dependencies"
	@echo "  test             - Run tests"
	@echo "  test-coverage    - Run tests with coverage report"
	@echo "  build            - Build for current platform"
	@echo "  build-all        - Build for all platforms"
	@echo "  build-linux      - Build for Linux amd64"
	@echo "  build-linux-arm64- Build for Linux arm64"
	@echo "  build-windows    - Build for Windows amd64"
	@echo "  build-windows-arm64 - Build for Windows arm64"
	@echo "  build-darwin     - Build for macOS amd64"
	@echo "  build-darwin-arm64 - Build for macOS arm64"
	@echo "  release          - Build release packages for all platforms"
	@echo "  dev              - Development build with race detection"
	@echo "  run              - Run development build"
	@echo "  bench            - Run benchmarks"
	@echo "  profile          - Build with profiling"
	@echo "  clean            - Clean build artifacts"
	@echo "  fmt              - Format code"
	@echo "  lint             - Lint code"
	@echo "  vet              - Vet code"
	@echo "  security         - Run security check"
	@echo "  install          - Install locally"
	@echo "  uninstall        - Uninstall locally"
	@echo "  help             - Show this help"

# Check if required tools are installed
.PHONY: check-tools
check-tools:
	@command -v go >/dev/null 2>&1 || { echo "Go is not installed"; exit 1; }
	@echo "All required tools are installed"