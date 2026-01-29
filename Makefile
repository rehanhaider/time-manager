run:
	@uv run tm sw

local:
	@echo "Installing time-manager (local dev)..."
	@uv pip install -e .
	@echo "Done."

global: build
	@echo "Installing time-manager system-wide..."
	@sudo cp dist/time-manager /usr/local/bin/time-manager
	@sudo ln -sf /usr/local/bin/time-manager /usr/local/bin/tm
	@echo "Done. You can now run 'time-manager' or 'tm' from anywhere."

bump:
	@./scripts/bump.sh

build: bump
	@echo "Building standalone executable..."
	@uv run pyinstaller --onefile --name time-manager src/app.py --collect-all textual --hidden-import=tui --hidden-import=tui.stopwatch --hidden-import=tui.countdown --add-data "src/tui/theme.tcss:tui"
	@echo "Building wheel..."
	@uv build
	@echo "Done. Executable is at dist/time-manager and wheel is at dist/time_manager-<version>-py3-none-any.whl"

clean:
	@rm -rf build dist *.spec __pycache__
	@echo "Cleaned build artifacts."

uninstall:
	@echo "Uninstalling time-manager..."
	-@sudo rm /usr/local/bin/time-manager
	-@sudo rm /usr/local/bin/tm
	@echo "Done."

publish:
	@echo "Publishing to PyPI..."
	@PROD="$(PROD)" ./scripts/publish.sh
	@echo "Done. Published to PyPI."

.PHONY: local global build bump clean uninstall publish