import typer
from tui import StopwatchApp, CountdownApp

# Create the Typer app
app = typer.Typer(help="A CLI based timer using Textual.")


@app.command()
def sw():
    """
    Start a stopwatch.
    """
    StopwatchApp().run()


@app.command()
def cd(
    amount: int = typer.Argument(..., help="The amount of time."),
    unit: str = typer.Argument("m", help="The unit of time. [s]econds, [m]inutes, [h]ours."),
):
    """
    Start a countdown timer.

    Example:
    timer cd 5 m
    timer cd 60 s
    timer cd 1 h
    """

    # Normalize unit
    unit = unit.lower().strip()

    seconds = 0
    if unit in ["s", "sec", "secs", "second", "seconds"]:
        seconds = amount
    elif unit in ["m", "min", "mins", "minute", "minutes"]:
        seconds = amount * 60
    elif unit in ["h", "hr", "hrs", "hour", "hours"]:
        seconds = amount * 3600
    else:
        typer.secho(f"Error: Unknown unit '{unit}'. Please use 's', 'm', or 'h'.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    if seconds <= 0:
        typer.secho("Error: Time must be greater than 0.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    CountdownApp(seconds).run()


def main():
    app()


if __name__ == "__main__":
    main()
