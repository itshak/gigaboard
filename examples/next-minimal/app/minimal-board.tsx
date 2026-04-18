"use client";

import { Chessboard, useChessGame } from "@ultrachess/react";

export function MinimalBoard() {
  const game = useChessGame();
  return <Chessboard game={game} />;
}
