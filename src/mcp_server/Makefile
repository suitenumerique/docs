# /!\ /!\ /!\ /!\ /!\ /!\ /!\ DISCLAIMER /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\
#
# This Makefile is only meant to be used for DEVELOPMENT purpose as we are
# changing the user id that will run in the container.
#
# PLEASE DO NOT USE IT FOR YOUR CI/PRODUCTION/WHATEVER...
#
# /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\
#
# Note to developers:
#
# While editing this file, please respect the following statements:
#
# 1. Every variable should be defined in the ad hoc VARIABLES section with a
#    relevant subsection
# 2. Every new rule should be defined in the ad hoc RULES section with a
#    relevant subsection depending on the targeted service
# 3. Rules should be sorted alphabetically within their section
# 4. When a rule has multiple dependencies, you should:
#    - duplicate the rule name to add the help string (if required)
#    - write one dependency per line to increase readability and diffs
# 5. .PHONY rule statement should be written after the corresponding rule
# ==============================================================================
# VARIABLES



BOLD := \033[1m
RESET := \033[0m
GREEN := \033[1;32m

# Use uv for package management
UV = uv

# ==============================================================================
# RULES

default: help

help:  ## Display this help message
	@echo "$(BOLD)Docs MCP server Makefile"
	@echo "Please use 'make $(BOLD)target$(RESET)' where $(BOLD)target$(RESET) is one of:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
.PHONY: help

install:  ## Install the project
	@$(UV) sync
.PHONY: install

install-dev:  ## Install the project with dev dependencies
	@$(UV) sync --extra dev
.PHONY: install-dev

clean:  ## Clean the project folder
	@rm -rf build/
	@rm -rf dist/
	@rm -rf *.egg-info
	@find . -type d -name __pycache__ -exec rm -rf {} +
	@find . -type f -name "*.pyc" -delete
.PHONY: clean

format:  ## Run the formatter
	@$(UV) run ruff format
.PHONY: format

lint: format  ## Run the linter
	@$(UV) run ruff check --fix .
.PHONY: lint

test:  ## Run the tests
	@cd tests && PYTHON_PATH=.:$(PYTHON_PATH) $(UV) run python -m pytest . -vvv
.PHONY: test

runserver:  ## Run the project server
	@$(UV) run python -m docs_mcp_server.mcp_server
.PHONY: runserver

runserver-docker:  ## Run the project server in a docker container
	@touch .env
	@docker compose up --watch
.PHONY: runserver-docker

run_llm:  ## Run the LLM server
	@mcphost -m ollama:qwen2.5:3b --config "$(CWD)/mcphost.json"
