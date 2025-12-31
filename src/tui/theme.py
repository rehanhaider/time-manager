"""Shared Textual theme for timer TUIs.

Primary:   #081e32
Secondary: #d5b77c
"""

from __future__ import annotations

PRIMARY = "#081e32"
PRIMARY_2 = "#0a2740"
SECONDARY = "#d5b77c"
SECONDARY_HOVER = "#e5c78c"

# Slight variations to create depth on top of the base palette.
CHROME = PRIMARY
# "Muted gold" for paused / secondary text. Textual accepts opacity with colors.
MUTED = f"{SECONDARY} 70%"

# Button accents that still harmonize with the palette.
DANGER = "#8b3a3a"
DANGER_HOVER = "#a04545"


TIMER_CSS = f"""
/* Foundation (Textual doesn't support CSS gradients / box-shadow, so we approximate) */
Screen {{
    background: {PRIMARY};
    color: {SECONDARY};
}}

Header {{
    background: {CHROME};
    color: {SECONDARY};
}}

Footer {{
    background: {PRIMARY};
    color: {SECONDARY} 60%;
}}

/* Footer "keycaps" */
FooterLabel {{
    background: transparent;
    color: {SECONDARY} 60%;
}}

.footer-key--key {{
    background: {SECONDARY} 10%;
    color: {SECONDARY};
    padding: 0 1;
    text-style: bold;
}}

.footer-key--description {{
    background: transparent;
    color: {SECONDARY} 60%;
}}

/* Main content area */
#content {{
    height: 1fr;
    width: 100%;
    align: center middle;
    padding: 1 2;
}}

/* Center “card” */
#display-container {{
    background: {SECONDARY} 5%;
    border: round {SECONDARY};
    outline: round {SECONDARY} 20%;
    padding: 3 10;
    margin: 1 0 2 0;
    width: auto;
    height: auto;
    min-width: 58;
    box-sizing: border-box;
}}

Digits {{
    color: {SECONDARY};
    text-opacity: 100%;
    width: auto;
    content-align: center middle;
}}

#status {{
    margin-top: 1;
    text-style: italic;
    text-opacity: 70%;
    color: {SECONDARY} 70%;
    content-align: center middle;
}}

/* Buttons (stopwatch only) */
#buttons {{
    layout: horizontal;
    height: auto;
    width: auto;
    align: center middle;
    margin-top: 1;
}}

Button {{
    background: {SECONDARY} 15%;
    color: {SECONDARY};
    border: round {SECONDARY};
    min-width: 16;
    height: 3;
    padding: 0 4;
    margin: 0 2;
}}

Button:hover {{
    offset: 0 -1;
}}

Button:disabled {{
    /* Avoid full-widget opacity: terminals blend alpha differently which can make disabled
       buttons appear to "disappear" in some emulators. */
    opacity: 100%;
    background: {SECONDARY} 8%;
    color: {SECONDARY} 45%;
    border: round {SECONDARY} 35%;
}}

Button.stop:disabled {{
    background: {DANGER} 25%;
    color: #fffaf0 55%;
    border: round {DANGER} 45%;
}}

Button:disabled:hover {{
    offset: 0 0;
}}

Button.start {{
    background: {SECONDARY};
    color: {PRIMARY};
    border: round {SECONDARY};
    text-style: bold;
}}

Button.start:hover {{
    background: {SECONDARY_HOVER};
}}

Button.stop {{
    background: {DANGER};
    color: #fffaf0;
    border: round {DANGER};
    text-style: bold;
}}

Button.stop:hover {{
    background: {DANGER_HOVER};
}}

Button.reset {{
    background: {SECONDARY} 15%;
    color: {SECONDARY};
    border: round {SECONDARY};
    text-style: bold;
}}

Button.reset:hover {{
    background: {SECONDARY} 25%;
}}
"""
