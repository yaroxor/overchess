import type { Square } from 'chess.js';

export type OverchessApi = {
	enableInput: () => void;
	updateInfo: () => void;
	updateOverlay: () => void;
};

export async function initOverchess(
	boardEl: HTMLElement,
	turnEl: HTMLElement,
	statusEl: HTMLElement
): Promise<OverchessApi> {
	// dynamic/browser-only imports
	const { Chess } = await import('chess.js');
	const { Chessboard, COLOR, INPUT_EVENT_TYPE, FEN } = await import('cm-chessboard');
	const { Markers, MARKER_TYPE } = await import('cm-chessboard/src/extensions/markers/Markers.js');

	// ---------------- Stockfish worker ----------------
	const worker = new Worker('/stockfish-18-lite-single.js');
	let stockfishReady = false;

	worker.postMessage('uci');
	worker.postMessage('setoption name Skill Level value 10');
	worker.postMessage('ucinewgame');

	// placeholders for closure-bound state
	const chess = new Chess();
	// board is created below after we have boardEl
	const board = new Chessboard(boardEl, {
		position: FEN.start,
		assetsUrl: '/cm-chessboard/assets/',
		style: { cssClass: 'black-and-white', showCoordinates: false },
		extensions: [{ class: Markers, props: { autoMarkers: MARKER_TYPE.frame } }]
	});

	worker.addEventListener('message', (e: MessageEvent<string>) => {
		const msg = e.data;
		if (msg === 'uciok') stockfishReady = true;
		if (msg.startsWith('bestmove')) {
			const move = msg.split(' ')[1];
			if (!move || move === '(none)') return;
			applyStockfishMove(move);
		}
	});

	function askStockfish() {
		if (!stockfishReady) return;
		worker.postMessage(`position fen ${chess.fen()}`);
		worker.postMessage('go movetime 500');
	}

	function applyStockfishMove(uciMove: string) {
		const from = uciMove.slice(0, 2);
		const to = uciMove.slice(2, 4);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const promotion = (uciMove[4] as any) ?? undefined;
		try {
			chess.move({ from, to, promotion });
			board.setPosition(chess.fen(), true);
			updateInfo();
			updateOverlay();
			if (!chess.isGameOver()) setTimeout(() => enableInput(), 350);
		} catch (err) {
			console.error('Stockfish move failed:', uciMove, err);
		}
	}

	// ---------------- Board state and handlers ----------------
	function updateInfo() {
		if (chess.isGameOver()) {
			turnEl.textContent = '';
			statusEl.textContent = chess.isCheckmate()
				? `Checkmate — ${chess.turn() === 'w' ? 'Black' : 'White'} wins`
				: chess.isStalemate()
					? 'Stalemate — draw'
					: 'Draw';
			return;
		}
		turnEl.textContent = chess.turn() === 'w' ? 'Your turn (White)' : 'Stockfish thinking…';
		statusEl.textContent = chess.isCheck() ? '⚠ Check' : '';
	}

	function enableInput() {
		board.disableMoveInput();
		if (chess.turn() === 'w') board.enableMoveInput(inputHandler, COLOR.white);
	}

	function inputHandler(event: { type: string; squareFrom: string; squareTo: string }): boolean {
		switch (event.type) {
			case INPUT_EVENT_TYPE.moveInputStarted: {
				board.removeLegalMovesMarkers();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const moves = chess.moves({ square: event.squareFrom as any, verbose: true });
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				board.addLegalMovesMarkers(moves.map((m: any) => ({ to: m.to, capture: !!m.captured })));
				return moves.length > 0;
			}
			case INPUT_EVENT_TYPE.validateMoveInput: {
				board.removeLegalMovesMarkers();
				try {
					const result = chess.move({ from: event.squareFrom, to: event.squareTo, promotion: 'q' });
					if (!result) return false;
					board.setPosition(chess.fen(), true);
					updateInfo();
					updateOverlay();
					if (!chess.isGameOver()) {
						board.disableMoveInput();
						setTimeout(() => askStockfish(), 300);
					}
					return true;
				} catch {
					return false;
				}
			}
			case INPUT_EVENT_TYPE.moveInputCanceled:
				board.removeLegalMovesMarkers();
				break;
		}
		return true;
	}

	// ---------------- Overlay setup ----------------
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const FILES = 'abcdefgh';
	const PIECE_COLOR: Record<string, string> = {
		// white pieces
		p: '#b088ff', // soft purple
		n: '#00d4ff', // cyan  (shared with bishop)
		b: '#00d4ff', // cyan
		r: '#ff00cc', // magenta  (shared with queen)
		q: '#ff00cc', // magenta
		k: '#ffe500', // yellow
		// black pieces — all one color, dashed stroke handles the distinction
		_black: '#ff2222'
	};

	// use provided boardEl as wrapper
	const boardWrap = boardEl;
	boardWrap.style.position = 'relative';

	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 8 8');
	svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

	const defs = document.createElementNS(SVG_NS, 'defs');
	function makeHatch(id: string, c1: string, c2: string) {
		const pat = document.createElementNS(SVG_NS, 'pattern');
		pat.setAttribute('id', id);
		pat.setAttribute('patternUnits', 'userSpaceOnUse');
		pat.setAttribute('width', '0.25');
		pat.setAttribute('height', '0.25');
		pat.setAttribute('patternTransform', 'rotate(45)');
		const r1 = document.createElementNS(SVG_NS, 'rect');
		r1.setAttribute('width', '0.125');
		r1.setAttribute('height', '0.25');
		r1.setAttribute('fill', c1);
		const r2 = document.createElementNS(SVG_NS, 'rect');
		r2.setAttribute('x', '0.125');
		r2.setAttribute('width', '0.125');
		r2.setAttribute('height', '0.25');
		r2.setAttribute('fill', c2);
		pat.appendChild(r1);
		pat.appendChild(r2);
		return pat;
	}
	defs.appendChild(makeHatch('hatch-both', 'rgba(80,200,80,0.45)', 'rgba(220,60,60,0.45)'));
	svg.appendChild(defs);

	const fillGroup = document.createElementNS(SVG_NS, 'g');
	const outlineGroup = document.createElementNS(SVG_NS, 'g');
	svg.appendChild(fillGroup);
	svg.appendChild(outlineGroup);
	boardWrap.appendChild(svg);

	function squareToXY(sq: string) {
		return { x: sq.charCodeAt(0) - 97, y: 7 - (parseInt(sq[1]) - 1) };
	}

	// ------ attack calculations (unchanged logic) ------
	function getPieceAttacks(type: string, color: 'w' | 'b', square: string): string[] {
		const file = square.charCodeAt(0) - 97;
		const rank = parseInt(square[1]) - 1;
		const boardGrid = chess.board();
		const result: string[] = [];

		const toSq = (f: number, r: number) => String.fromCharCode(97 + f) + (r + 1);
		const inBounds = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
		const pieceAt = (f: number, r: number) => boardGrid[7 - r]?.[f];

		const jump = (df: number, dr: number) => {
			const f = file + df,
				r = rank + dr;
			if (inBounds(f, r)) result.push(toSq(f, r));
		};

		const slide = (df: number, dr: number) => {
			let f = file + df,
				r = rank + dr;
			while (inBounds(f, r)) {
				result.push(toSq(f, r));
				if (pieceAt(f, r)) break;
				f += df;
				r += dr;
			}
		};

		switch (type) {
			case 'p': {
				const dir = color === 'w' ? 1 : -1;
				jump(-1, dir);
				jump(1, dir);
				break;
			}
			case 'n':
				[
					[-2, -1],
					[-2, 1],
					[-1, -2],
					[-1, 2],
					[1, -2],
					[1, 2],
					[2, -1],
					[2, 1]
				].forEach(([df, dr]) => jump(df, dr));
				break;
			case 'b':
				[
					[-1, -1],
					[-1, 1],
					[1, -1],
					[1, 1]
				].forEach(([df, dr]) => slide(df, dr));
				break;
			case 'r':
				[
					[-1, 0],
					[1, 0],
					[0, -1],
					[0, 1]
				].forEach(([df, dr]) => slide(df, dr));
				break;
			case 'q':
				[
					[-1, -1],
					[-1, 1],
					[1, -1],
					[1, 1],
					[-1, 0],
					[1, 0],
					[0, -1],
					[0, 1]
				].forEach(([df, dr]) => slide(df, dr));
				break;
			case 'k':
				[
					[-1, -1],
					[-1, 0],
					[-1, 1],
					[0, -1],
					[0, 1],
					[1, -1],
					[1, 0],
					[1, 1]
				].forEach(([df, dr]) => jump(df, dr));
				break;
		}
		return result;
	}

	function getAttackerMap() {
		const map = new Map<string, { w: Set<string>; b: Set<string> }>();
		const ensure = (sq: string) => {
			if (!map.has(sq)) map.set(sq, { w: new Set(), b: new Set() });
			return map.get(sq)!;
		};
		for (const row of chess.board()) {
			for (const piece of row) {
				if (!piece) continue;
				for (const sq of getPieceAttacks(piece.type, piece.color, piece.square)) {
					ensure(sq)[piece.color].add(piece.type);
				}
			}
		}
		return map;
	}

	function updateOverlay() {
		while (fillGroup.firstChild) fillGroup.removeChild(fillGroup.firstChild);
		while (outlineGroup.firstChild) outlineGroup.removeChild(outlineGroup.firstChild);

		const wFill = new Set<string>();
		const bFill = new Set<string>();
		for (let f = 0; f < 8; f++) {
			for (let r = 1; r <= 8; r++) {
				const sq = (FILES[f] + r) as Square;
				if (chess.isAttacked(sq, 'w')) wFill.add(sq);
				if (chess.isAttacked(sq, 'b')) bFill.add(sq);
			}
		}
		for (const sq of new Set([...wFill, ...bFill])) {
			const { x, y } = squareToXY(sq);
			const rect = document.createElementNS(SVG_NS, 'rect');
			rect.setAttribute('x', String(x));
			rect.setAttribute('y', String(y));
			rect.setAttribute('width', '1');
			rect.setAttribute('height', '1');
			const inW = wFill.has(sq),
				inB = bFill.has(sq);
			rect.setAttribute(
				'fill',
				inW && inB ? 'url(#hatch-both)' : inW ? 'rgba(80,200,80,0.35)' : 'rgba(220,60,60,0.35)'
			);
			fillGroup.appendChild(rect);
		}

		const attackerMap = getAttackerMap();
		for (const [sq, { w, b }] of attackerMap) {
			const { x, y } = squareToXY(sq);
			const attackers: Array<{ color: 'w' | 'b'; type: string }> = [
				...[...w].map((t) => ({ color: 'w' as const, type: t })),
				...[...b].map((t) => ({ color: 'b' as const, type: t }))
			];
			attackers.forEach(({ color, type }, i) => {
				const inset = 0.04 + i * 0.07;
				const strokeColor = color === 'b' ? '#ff2222' : PIECE_COLOR[type];
				const rect = document.createElementNS(SVG_NS, 'rect');
				rect.setAttribute('x', String(x + inset));
				rect.setAttribute('y', String(y + inset));
				rect.setAttribute('width', String(1 - inset * 2));
				rect.setAttribute('height', String(1 - inset * 2));
				rect.setAttribute('fill', 'none');
				rect.setAttribute('stroke', PIECE_COLOR[type]);
				rect.setAttribute('stroke-width', '0.04');
				rect.setAttribute('stroke', strokeColor);
				outlineGroup.appendChild(rect);
			});
		}
	}

	return {
		enableInput,
		updateInfo,
		updateOverlay
	};
}
