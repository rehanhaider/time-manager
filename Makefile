help:
	@echo "Usage: make <target>"
	@echo "Targets:"
	@echo "  run                Run the app (stopwatch)"
	@echo "  test               Run tests"
	@echo "  typecheck          Typecheck with tsc"
	@echo "  build              Compile standalone binaries for all platforms"
	@echo "  package            Assemble npm packages + release artifacts"
	@echo "  bump               Bump patch version (TYPE=minor|major for others)"
	@echo "  release            Tag the current version and push (triggers CI release)"
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

release:
	@version=$$(bun -e 'console.log((await Bun.file("package.json").json()).version)'); \
	git tag "v$$version" && git push origin "v$$version" && \
	echo "Pushed tag v$$version — GitHub Actions will build and publish."

clean:
	@rm -rf dist
	@echo "Cleaned build artifacts."

.PHONY: help run test typecheck build package bump release clean
