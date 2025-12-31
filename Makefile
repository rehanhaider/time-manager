local:
	@echo "Installing timer (local dev)..."
	@uv pip install -e .
	@echo "Done."

global: build
	@echo "Installing timer system-wide..."
	@sudo cp dist/timer /usr/local/bin/timer
	@echo "Done. You can now run 'timer' from anywhere."

bump:
	@./scripts/bump.sh

build: bump
	@echo "Building standalone executable..."
	@uv run pyinstaller --onefile --name timer src/app.py --collect-all textual --hidden-import=tui --hidden-import=tui.stopwatch --hidden-import=tui.countdown --add-data "src/tui/theme.tcss:tui"
	@echo "Done. Executable is at dist/timer"

clean:
	@rm -rf build dist *.spec __pycache__
	@echo "Cleaned build artifacts."

uninstall:
	@echo "Uninstalling timer..."
	-@sudo rm /usr/local/bin/timer
	@echo "Done."

.PHONY: local global build bump clean uninstall