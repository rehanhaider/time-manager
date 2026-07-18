import {
  BoxRenderable,
  TextAttributes,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core"

export interface ButtonColors {
  bg: string
  fg: string
  hoverBg: string
  hoverFg: string
  disabledBg: string
  disabledFg: string
}

/** Clickable flat button: a Box with a bold centered label and hover/disabled states. */
export class Button {
  readonly box: BoxRenderable
  private readonly label: TextRenderable
  private hovered = false
  private disabled = false

  constructor(
    renderer: CliRenderer,
    id: string,
    text: string,
    private readonly colors: ButtonColors,
    onPress: () => void,
  ) {
    this.box = new BoxRenderable(renderer, {
      id,
      height: 3,
      paddingX: 7,
      marginX: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.bg,
      onMouseDown: () => {
        if (!this.disabled) onPress()
      },
      onMouseOver: () => {
        this.hovered = true
        this.refresh()
      },
      onMouseOut: () => {
        this.hovered = false
        this.refresh()
      },
    })
    this.label = new TextRenderable(renderer, {
      id: `${id}-label`,
      content: text,
      fg: colors.fg,
      attributes: TextAttributes.BOLD,
    })
    this.box.add(this.label)
  }

  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return
    this.disabled = disabled
    this.refresh()
  }

  private refresh(): void {
    const { colors } = this
    if (this.disabled) {
      this.box.backgroundColor = colors.disabledBg
      this.label.fg = colors.disabledFg
    } else if (this.hovered) {
      this.box.backgroundColor = colors.hoverBg
      this.label.fg = colors.hoverFg
    } else {
      this.box.backgroundColor = colors.bg
      this.label.fg = colors.fg
    }
  }
}
