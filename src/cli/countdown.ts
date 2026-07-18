import { Countdown } from "../core/termclock.ts"
import { formatTime } from "../core/formatting.ts"
import { InlineRegion, ansi, center, drawPanel, style, terminalWidth, withRawInput } from "./ansi.ts"

const SUBTITLE = "Space: Pause/Resume | q: Quit"

/** Lightweight (non-TUI) countdown: a live panel rendered inline in the scrollback. */
export function runCountdownCli(seconds: number): Promise<void> {
  const countdown = new Countdown(seconds)

  const region = new InlineRegion()
  process.stdout.write(ansi.hideCursor)

  return new Promise((resolve) => {
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      restoreInput()
      process.stdout.write(ansi.showCursor)
      resolve()
    }

    const restoreInput = withRawInput((key) => {
      if (key === "q" || key === "Q" || key === "\x03") {
        finish()
      } else if (key === " ") {
        countdown.toggle()
      }
    })

    const contentWidth = () => Math.max(4, terminalWidth() - 2) - 4

    const draw = () => {
      countdown.tick()
      const remaining = countdown.timeLeft

      if (countdown.isFinished) {
        // Final "Time's Up" frame: ring the bell, show it briefly, then exit.
        clearInterval(timer)
        process.stdout.write("\x07")
        region.render(
          drawPanel([center(style("00:00", ansi.bold, ansi.red, ansi.blink), contentWidth())], {
            title: "Countdown",
            subtitle: "Time's Up!",
            borderColor: ansi.red,
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

      region.render(
        drawPanel([center(style(timeStr, ...timeStyle), contentWidth())], {
          title: "Countdown",
          subtitle: SUBTITLE,
          borderColor: running ? color : ansi.white,
        }),
      )
    }

    draw()
    const timer = setInterval(draw, 100)
  })
}
