
export type Role = 'rock' | 'paper' | 'scissors';
export type PieceType = 'king' | 'unit';

export interface Piece {
  id: string;
  owner: string; // user_id
  type: PieceType;
  role: Role;
  revealed: boolean;
  hasFlag: boolean;
  isDead: boolean;
}

export interface BoardState {
  pieces: Piece[];
  rows: number;
  cols: number;
  setupPhase: {
    [userId: string]: {
      ready: boolean;
      piecesSet: boolean; // have they assigned their 3 custom roles and flag?
    }
  };
}

// Re-defining properly with position
export interface PieceWithPos extends Piece {
  row: number;
  col: number;
}

export interface GameState {
  board: PieceWithPos[];
  turn: string; // current player id
  winner?: string;
  setup: {
    [userId: string]: {
      ready: boolean;
    }
  };
  log: string[]; // Combat logs
}

export const initGame = (p1: string, p2: string): GameState => {
  const pieces: PieceWithPos[] = [];

  // Player 2 (Top)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 8; c++) {
      const isKing = r === 0 && c === 4;
      pieces.push({
        id: `p2-${r}-${c}`,
        owner: p2,
        type: isKing ? 'king' : 'unit',
        role: getRandomRole(), // Random initially, user can change 3 of them
        revealed: false,
        hasFlag: false,
        isDead: false,
        row: r,
        col: c
      });
    }
  }

  // Player 1 (Bottom)
  for (let r = 6; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isKing = r === 7 && c === 4;
      pieces.push({
        id: `p1-${r}-${c}`,
        owner: p1,
        type: isKing ? 'king' : 'unit',
        role: getRandomRole(),
        revealed: false,
        hasFlag: false,
        isDead: false,
        row: r,
        col: c
      });
    }
  }

  return {
    board: pieces,
    turn: p1, // P1 starts
    setup: {
      [p1]: { ready: false },
      [p2]: { ready: false }
    },
    log: []
  };
};

const getRandomRole = (): Role => {
  const roles: Role[] = ['rock', 'paper', 'scissors'];
  return roles[Math.floor(Math.random() * roles.length)];
};

export const resolveCombat = (attacker: PieceWithPos, defender: PieceWithPos): { winner: PieceWithPos | null, loser: PieceWithPos | null, draw: boolean } => {
  const a = attacker.role;
  const d = defender.role;

  if (a === d) return { winner: null, loser: null, draw: true };
  
  if (
    (a === 'rock' && d === 'scissors') ||
    (a === 'scissors' && d === 'paper') ||
    (a === 'paper' && d === 'rock')
  ) {
    return { winner: attacker, loser: defender, draw: false };
  }

  return { winner: defender, loser: attacker, draw: false };
};

export const isValidMove = (piece: PieceWithPos, toRow: number, toCol: number, board: PieceWithPos[]): boolean => {
  if (piece.isDead) return false;
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

  // Check if target occupied by own piece
  const target = board.find(p => p.row === toRow && p.col === toCol && !p.isDead);
  if (target && target.owner === piece.owner) return false;

  const dRow = Math.abs(toRow - piece.row);
  const dCol = Math.abs(toCol - piece.col);

  if (piece.type === 'king') {
    // Queen movement: diagonal, horizontal, vertical
    if (dRow !== dCol && dRow !== 0 && dCol !== 0) return false;
    
    // Check path for collision
    const rStep = toRow === piece.row ? 0 : (toRow > piece.row ? 1 : -1);
    const cStep = toCol === piece.col ? 0 : (toCol > piece.col ? 1 : -1);
    
    let r = piece.row + rStep;
    let c = piece.col + cStep;
    
    while (r !== toRow || c !== toCol) {
      if (board.some(p => p.row === r && p.col === c && !p.isDead)) return false; // Blocked
      r += rStep;
      c += cStep;
    }
    return true;
  } else {
    // Unit: 1 step any direction
    return dRow <= 1 && dCol <= 1 && (dRow !== 0 || dCol !== 0);
  }
};
