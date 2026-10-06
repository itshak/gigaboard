import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardEditor } from "../src/board-editor.js";

describe("BoardEditor", () => {
  it("renders with role='application' and default aria attributes", () => {
    render(<BoardEditor />);
    const editor = screen.getByRole("application");
    expect(editor).not.toBeNull();
    expect(editor.getAttribute("aria-label")).toBe("Board editor");
    expect(editor.getAttribute("tabindex")).toBe("0");
    expect(editor.getAttribute("data-gb-editor")).toBe("true");
    expect(editor.getAttribute("aria-keyshortcuts")).toContain("Backspace");
    expect(editor.getAttribute("aria-keyshortcuts")).toContain("p P");
  });

  it("navigates cell by cell with arrow keys", () => {
    const onSquareFocus = vi.fn();
    const onAnnounce = vi.fn();
    render(<BoardEditor onSquareFocus={onSquareFocus} onAnnounce={onAnnounce} />);
    const editor = screen.getByRole("application");
    editor.focus();

    // Default start square in white orientation is e4 (index 28)
    expect(onAnnounce).toHaveBeenCalledWith("e4, empty");

    // ArrowUp -> e5
    fireEvent.keyDown(editor, { key: "ArrowUp" });
    expect(onAnnounce).toHaveBeenCalledWith("e5, empty");

    // ArrowRight -> f5
    fireEvent.keyDown(editor, { key: "ArrowRight" });
    expect(onAnnounce).toHaveBeenCalledWith("f5, empty");

    // ArrowDown -> f4
    fireEvent.keyDown(editor, { key: "ArrowDown" });
    expect(onAnnounce).toHaveBeenCalledWith("f4, empty");

    // ArrowLeft -> e4
    fireEvent.keyDown(editor, { key: "ArrowLeft" });
    expect(onAnnounce).toHaveBeenCalledWith("e4, empty");
  });

  it("places pieces using quick shortcuts: p (black pawn), P (white pawn), K (white king), k (black king)", () => {
    const onChange = vi.fn();
    const onAnnounce = vi.fn();
    const onSelectPiece = vi.fn();

    render(
      <BoardEditor onChange={onChange} onAnnounce={onAnnounce} onSelectPiece={onSelectPiece} />,
    );
    const editor = screen.getByRole("application");
    editor.focus(); // On e4

    // 'p' -> places Black pawn on e4
    fireEvent.keyDown(editor, { key: "p" });
    expect(onAnnounce).toHaveBeenCalledWith("black pawn placed on e4");
    expect(onChange).toHaveBeenCalled();
    const fenAfterP = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenAfterP).toContain("p");

    // Move to e5
    fireEvent.keyDown(editor, { key: "ArrowUp" });

    // 'P' -> places White pawn on e5
    fireEvent.keyDown(editor, { key: "P" });
    expect(onAnnounce).toHaveBeenCalledWith("white pawn placed on e5");
    const fenAfterCapP = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenAfterCapP).toContain("P");

    // Move to e1 (down 4)
    fireEvent.keyDown(editor, { key: "ArrowDown" });
    fireEvent.keyDown(editor, { key: "ArrowDown" });
    fireEvent.keyDown(editor, { key: "ArrowDown" });
    fireEvent.keyDown(editor, { key: "ArrowDown" });

    // 'K' -> places White king on e1
    fireEvent.keyDown(editor, { key: "K" });
    expect(onAnnounce).toHaveBeenCalledWith("white king placed on e1");

    // Move to e8 (up 7)
    for (let i = 0; i < 7; i++) {
      fireEvent.keyDown(editor, { key: "ArrowUp" });
    }

    // 'k' -> places Black king on e8
    fireEvent.keyDown(editor, { key: "k" });
    expect(onAnnounce).toHaveBeenCalledWith("black king placed on e8");
  });

  it("deletes a piece from the cell using Backspace and Delete", () => {
    const onChange = vi.fn();
    const onAnnounce = vi.fn();

    render(
      <BoardEditor
        fen="8/8/8/8/4P3/8/8/8 w - - 0 1" // White pawn on e4
        onChange={onChange}
        onAnnounce={onAnnounce}
      />,
    );
    const editor = screen.getByRole("application");
    editor.focus(); // Focus e4 (contains White pawn)

    expect(onAnnounce).toHaveBeenCalledWith("e4, white pawn");

    // Press Backspace
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(onAnnounce).toHaveBeenCalledWith("Piece removed from e4");
    const fenAfterBack = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenAfterBack).toBe("8/8/8/8/8/8/8/8 w - - 0 1");

    // Place a black knight with 'n'
    fireEvent.keyDown(editor, { key: "n" });
    expect(onAnnounce).toHaveBeenCalledWith("black knight placed on e4");

    // Press Delete
    fireEvent.keyDown(editor, { key: "Delete" });
    expect(onAnnounce).toHaveBeenCalledWith("Piece removed from e4");
    const fenAfterDel = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenAfterDel).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
  });

  it("toggles a piece off if the same piece shortcut is pressed", () => {
    const onChange = vi.fn();
    const onAnnounce = vi.fn();

    render(<BoardEditor onChange={onChange} onAnnounce={onAnnounce} />);
    const editor = screen.getByRole("application");
    editor.focus(); // e4

    // Place White Queen with 'Q'
    fireEvent.keyDown(editor, { key: "Q" });
    expect(onAnnounce).toHaveBeenCalledWith("white queen placed on e4");

    // Press 'Q' again on the same square -> toggles off
    fireEvent.keyDown(editor, { key: "Q" });
    expect(onAnnounce).toHaveBeenCalledWith("Piece removed from e4");
    const fen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fen).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
  });

  it("supports Enter/Space to place selectedPiece and Shift+Enter for opposite color", () => {
    const onChange = vi.fn();
    const onAnnounce = vi.fn();

    render(<BoardEditor selectedPiece="wR" onChange={onChange} onAnnounce={onAnnounce} />);
    const editor = screen.getByRole("application");
    editor.focus();

    // Enter places wR
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onAnnounce).toHaveBeenCalledWith("white rook placed on e4");

    // Arrow to e5
    fireEvent.keyDown(editor, { key: "ArrowUp" });

    // Shift+Enter places bR (opposite color)
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(onAnnounce).toHaveBeenCalledWith("black rook placed on e5");
  });

  it("supports 'c' to clear and 's' to set starting position", () => {
    const onClear = vi.fn();
    const onSetStartingPosition = vi.fn();
    const onToggleSideToMove = vi.fn();

    render(
      <BoardEditor
        onClear={onClear}
        onSetStartingPosition={onSetStartingPosition}
        onToggleSideToMove={onToggleSideToMove}
      />,
    );
    const editor = screen.getByRole("application");
    editor.focus();

    fireEvent.keyDown(editor, { key: "c" });
    expect(onClear).toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: "s" });
    expect(onSetStartingPosition).toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: "t" });
    expect(onToggleSideToMove).toHaveBeenCalled();
  });

  it("handles all other piece shortcuts: n, N, b, B, r, R", () => {
    const onChange = vi.fn();
    render(<BoardEditor onChange={onChange} />);
    const editor = screen.getByRole("application");
    editor.focus();

    fireEvent.keyDown(editor, { key: "n" }); // Black knight
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain("n");

    fireEvent.keyDown(editor, { key: "N" }); // White knight
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain("N");

    fireEvent.keyDown(editor, { key: "b" }); // Black bishop
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain("b");

    fireEvent.keyDown(editor, { key: "B" }); // White bishop
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain("B");

    fireEvent.keyDown(editor, { key: "r" }); // Black rook
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain("r");

    fireEvent.keyDown(editor, { key: "R" }); // White rook
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain("R");
  });

  it("navigates correctly in black orientation", () => {
    const onAnnounce = vi.fn();
    render(<BoardEditor orientation="black" onAnnounce={onAnnounce} />);
    const editor = screen.getByRole("application");
    editor.focus();

    // Default square for black orientation is e5 (index 35)
    expect(onAnnounce).toHaveBeenCalledWith("e5, empty");

    // ArrowUp in black orientation moves towards rank 4 (down visually/geometrically)
    fireEvent.keyDown(editor, { key: "ArrowUp" });
    expect(onAnnounce).toHaveBeenCalledWith("e4, empty");
  });

  it("announces empty when Backspace is pressed on an already empty square", () => {
    const onAnnounce = vi.fn();
    render(<BoardEditor onAnnounce={onAnnounce} />);
    const editor = screen.getByRole("application");
    editor.focus(); // On e4 (empty)

    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(onAnnounce).toHaveBeenCalledWith("e4 is empty");
  });

  it("passes algebraic notation as 3rd parameter to callbacks", () => {
    const onSquareFocus = vi.fn();
    const onPieceChange = vi.fn();
    render(<BoardEditor onSquareFocus={onSquareFocus} onPieceChange={onPieceChange} />);
    const editor = screen.getByRole("application");
    editor.focus();

    expect(onSquareFocus).toHaveBeenCalledWith(28, 0, "e4");

    fireEvent.keyDown(editor, { key: "P" });
    expect(onPieceChange).toHaveBeenCalledWith(28, 1, "e4");
  });
});
