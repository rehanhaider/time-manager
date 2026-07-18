help:
	@echo "Usage: make <target>"
	@echo "Targets:"
	@echo "  run                Run the app (stopwatch)"
	@echo "  test               Run tests"
	@echo "  typecheck          Typecheck with tsc"
	@echo "  build              Compile standalone binaries for all platforms"
	@echo "  package            Assemble npm packages + release artifacts"
	@echo "  bump               Bump patch version (TYPE=minor|major for others)"
	@echo "  publish [PROD=TRUE]  Publish locally: default is a rehearsal (npm dry-run"
	@echo "                     + TestPyPI); PROD=TRUE does npm + PyPI + GitHub release"
	@echo "  clean              Remove build artifacts"

run:
	@bun run src/index.ts sw

test:
	@bun test

typecheck:
	@bunx tsc --noEmit

build:
	@bun run scripts/build.ts

package: build
	@bun run scripts/package.ts
	@python3 scripts/build_wheels.py

TYPE ?= patch
bump:
	@npm version $(TYPE) --no-git-tag-version
	@echo "Bumped to $$(bun -e 'console.log((await Bun.file("package.json").json()).version)')"

publish:
	@echo "Publishing..."
	@PROD="$(PROD)" ./scripts/publish.sh

clean:
	@rm -rf dist
	@echo "Cleaned build artifacts."

.PHONY: help run test typecheck build package bump publish clean
