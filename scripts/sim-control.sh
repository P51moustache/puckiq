#!/bin/bash
# sim-control.sh — Wrapper for ios-simulator-skill scripts
# Handles Python version (3.13) and auto-detects booted simulator UDID
#
# Usage:
#   ./scripts/sim-control.sh screenshot [output_path]
#   ./scripts/sim-control.sh scroll-down              # Reliable long scroll
#   ./scripts/sim-control.sh scroll-up                # Scroll back to top
#   ./scripts/sim-control.sh scroll-screenshot [dir]  # Full page capture (3 screenshots)
#   ./scripts/sim-control.sh screen_mapper            # List UI elements
#   ./scripts/sim-control.sh navigator --find-text "Login" --tap
#   ./scripts/sim-control.sh gesture --swipe up
#   ./scripts/sim-control.sh tap X Y                  # Tap at coordinates
#   ./scripts/sim-control.sh navigate [route]         # Deep link navigation

SKILL_DIR="$HOME/.claude/skills/ios-simulator-skill/ios-simulator-skill/scripts"
PYTHON="python3.13"

# Get booted simulator UDID
UDID=$(xcrun simctl list devices booted | grep -oE '[A-F0-9-]{36}' | head -1)
if [ -z "$UDID" ]; then
  echo "Error: No booted simulator found"
  exit 1
fi

export IDB_UDID="$UDID"

SCRIPT="$1"
shift

case "$SCRIPT" in
  screenshot)
    OUTPUT="${1:-/tmp/sim_screenshot.png}"
    xcrun simctl io booted screenshot "$OUTPUT"
    echo "Screenshot: $OUTPUT"
    ;;

  scroll-down)
    # Reliable scroll: long swipe from bottom-center to top-center with duration
    $PYTHON -m idb.cli.main ui swipe 196 650 196 100 --duration 0.5 --udid "$UDID" 2>/dev/null
    echo "Scrolled down"
    ;;

  scroll-up)
    # Scroll back up
    $PYTHON -m idb.cli.main ui swipe 196 100 196 650 --duration 0.5 --udid "$UDID" 2>/dev/null
    echo "Scrolled up"
    ;;

  scroll-screenshot)
    # Full page capture: top, middle, bottom screenshots
    DIR="${1:-/tmp/sim_audit}"
    mkdir -p "$DIR"

    # Scroll to top first
    $PYTHON -m idb.cli.main ui swipe 196 100 196 650 --duration 0.5 --udid "$UDID" 2>/dev/null
    sleep 0.3
    $PYTHON -m idb.cli.main ui swipe 196 100 196 650 --duration 0.5 --udid "$UDID" 2>/dev/null
    sleep 0.3
    $PYTHON -m idb.cli.main ui swipe 196 100 196 650 --duration 0.5 --udid "$UDID" 2>/dev/null
    sleep 0.5

    # Screenshot 1: top
    xcrun simctl io booted screenshot "$DIR/1_top.png"
    echo "Captured: $DIR/1_top.png"

    # Scroll down
    $PYTHON -m idb.cli.main ui swipe 196 650 196 100 --duration 0.5 --udid "$UDID" 2>/dev/null
    sleep 0.5

    # Screenshot 2: middle
    xcrun simctl io booted screenshot "$DIR/2_mid.png"
    echo "Captured: $DIR/2_mid.png"

    # Scroll down again
    $PYTHON -m idb.cli.main ui swipe 196 650 196 100 --duration 0.5 --udid "$UDID" 2>/dev/null
    sleep 0.5

    # Screenshot 3: bottom
    xcrun simctl io booted screenshot "$DIR/3_bottom.png"
    echo "Captured: $DIR/3_bottom.png"

    echo "Full audit saved to $DIR/"
    ;;

  tap)
    X="${1:?Missing X coordinate}"
    Y="${2:?Missing Y coordinate}"
    $PYTHON -m idb.cli.main ui tap "$X" "$Y" --udid "$UDID" 2>/dev/null
    echo "Tapped ($X, $Y)"
    ;;

  navigate)
    ROUTE="${1:-/}"
    xcrun simctl openurl booted "exp+learning-project://$ROUTE"
    echo "Navigated to /$ROUTE"
    ;;

  screen_mapper|navigator|gesture|keyboard|app_launcher|accessibility_audit|visual_diff|log_monitor)
    $PYTHON "$SKILL_DIR/${SCRIPT}.py" "$@"
    ;;

  health)
    bash "$SKILL_DIR/sim_health_check.sh"
    ;;

  *)
    echo "sim-control.sh — iOS Simulator automation for AI agents"
    echo ""
    echo "Quick commands:"
    echo "  screenshot [path]          Take a screenshot (default: /tmp/sim_screenshot.png)"
    echo "  scroll-down                Scroll content down (reliable long swipe)"
    echo "  scroll-up                  Scroll content up"
    echo "  scroll-screenshot [dir]    Full page: 3 screenshots (top/mid/bottom)"
    echo "  tap X Y                    Tap at coordinates"
    echo "  navigate [route]           Deep link (e.g., 'models', 'stats')"
    echo ""
    echo "Skill scripts:"
    echo "  screen_mapper              Analyze current screen UI elements"
    echo "  navigator [args]           Find/interact with elements by text/type"
    echo "  gesture [args]             Swipe, pinch, long press"
    echo "  keyboard [args]            Type text, press keys"
    echo "  accessibility_audit        WCAG compliance check"
    echo "  visual_diff [args]         Compare screenshots"
    echo "  health                     Environment health check"
    ;;
esac
