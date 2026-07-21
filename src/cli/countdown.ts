import { Countdown } from "../core/termclock.ts"
import { formatTime } from "../core/formatting.ts"
import {
  LiveScreen,
  ansi,
  drawPanel,
  fitText,
  onTerminalResize,
  style,
  terminalWidth,
  withRawInput,
} from "./ansi.ts"

/** Progressively shorter key hints, widest first. */
const SUBTITLES = ["Space: Pause/Resume | q: Quit", "space · q", "␣ q"]

/** Lightweight (non-TUI) countdown: a live panel rendered inline in the scrollback. */
export function runCountdownCli(seconds: number): Promise<void> {
  const countdown = new Countdown(seconds)

  const screen = new LiveScreen()
  screen.start()
  // Belt and braces: never strand the terminal on the alternate buffer.
  const restoreScreen = () => screen.stop()
  process.on("exit", restoreScreen)

  return new Promise((resolve) => {
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      stopResize()
      restoreInput()
      screen.stop()
      process.off("exit", restoreScreen)
      resolve()
    }

    const restoreInput = withRawInput((key) => {
      if (key === "q" || key === "Q" || key === "\x03") {
        finish()
      } else if (key === " ") {
        countdown.toggle()
      }
    })

    const title = () => fitText(["Countdown", "CD"], terminalWidth() - 6)

    const draw = () => {
      countdown.tick()
      const remaining = countdown.timeLeft

      if (countdown.isFinished) {
        // Final "Time's Up" frame: ring the bell, show it briefly, then exit.
        clearInterval(timer)
        process.stdout.write("\x07")
        screen.render(
          drawPanel([style("00:00", ansi.bold, ansi.red, ansi.blink)], {
            title: title(),
            subtitle: fitText(["Time's Up!", "Done"], terminalWidth() - 6),
            borderColor: ansi.red,
            align: "center",
          }),
        )
        setTimeout(finish, 2000)
        return
      }

      let color: string = ansi.blue
      if (remaining < 10) color = ansi.red
      else if (remaining < 30) color = ansi.yellow

      const running = countdown.isRunning
      const timeStr = formatTime(remaining, { showCentiseconds: false })
      const timeStyle = running ? [ansi.bold, color] : [ansi.dim, color]

      screen.render(
        drawPanel([style(timeStr, ...timeStyle)], {
          title: title(),
          subtitle: fitText(SUBTITLES, terminalWidth() - 6),
          borderColor: running ? color : ansi.white,
          align: "center",
        }),
      )
    }

    // Repaint immediately on resize rather than waiting for the next tick.
    const stopResize = onTerminalResize(() => {
      if (!finished) draw()
    })

    draw()
    const timer = setInterval(draw, 100)
  })
}
