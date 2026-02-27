import type { Square } from 'chess.js';

export type OverlaySettings = {
	side: 'white' | 'black' | 'both';
	style: 'squares' | 'arrows';
};

export const defaultSettings: OverlaySettings = {
	side: 'white',
	style: 'squares'
};

export type OverchessApi = {
	enableInput: () => void;
	updateInfo: () => void;
	updateOverlay: (settings: OverlaySettings) => void;
};

export async function initOverchess(
	boardEl: HTMLElement,
	turnEl: HTMLElement,
	statusEl: HTMLElement
): Promise<OverchessApi> {
	const { Chess } = await import('chess.js');
	const { Chessboard, COLOR, INPUT_EVENT_TYPE, FEN } = await import('cm-chessboard');
	const { Markers, MARKER_TYPE } = await import('cm-chessboard/src/extensions/markers/Markers.js');

	// ---------------- Stockfish ----------------
	const worker = new Worker('/stockfish-18-lite-single.js');
	let stockfishReady = false;
	worker.postMessage('uci');
	worker.postMessage('setoption name Skill Level value 10');
	worker.postMessage('ucinewgame');

	const chess = new Chess();
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
		 
		const promotion = (uciMove[4] as any) ?? undefined;
		try {
			chess.move({ from, to, promotion });
			board.setPosition(chess.fen(), true);
			updateInfo();
			updateOverlay(currentSettings);
			if (!chess.isGameOver()) setTimeout(() => enableInput(), 350);
		} catch (err) {
			console.error('Stockfish move failed:', uciMove, err);
		}
	}

	// ---------------- Board ----------------
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
				 
				const moves = chess.moves({ square: event.squareFrom as any, verbose: true });
				 
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
					updateOverlay(currentSettings);
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

	// ---------------- Overlay ----------------
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const FILES = 'abcdefgh';

	// white pieces get distinct colors, black pieces all get red
	const PIECE_COLOR: Record<string, string> = {
		p: '#b088ff', // soft purple
		n: '#00d4ff', // cyan (shared with bishop)
		b: '#00d4ff',
		r: '#ff00cc', // magenta (shared with queen)
		q: '#ff00cc',
		k: '#ffe500' // yellow
	};
	const BLACK_COLOR = '#ff2222';

	const boardWrap = boardEl;
	boardWrap.style.position = 'relative';

	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 8 8');
	svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

	const defs = document.createElementNS(SVG_NS, 'defs');

	// hatch pattern for contested squares
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

	// arrowhead markers — one per unique color
	function makeArrowMarker(id: string, color: string) {
		const marker = document.createElementNS(SVG_NS, 'marker');
		marker.setAttribute('id', id);
		marker.setAttribute('markerWidth', '4');
		marker.setAttribute('markerHeight', '4');
		marker.setAttribute('refX', '3');
		marker.setAttribute('refY', '2');
		marker.setAttribute('orient', 'auto');
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', 'M0,0 L0,4 L4,2 z');
		path.setAttribute('fill', color);
		marker.appendChild(path);
		return marker;
	}

	const arrowColors = [
		['arrow-purple', '#b088ff'],
		['arrow-cyan', '#00d4ff'],
		['arrow-magenta', '#ff00cc'],
		['arrow-yellow', '#ffe500'],
		['arrow-red', '#ff2222']
	] as const;

	const colorToMarkerId: Record<string, string> = {};
	for (const [id, color] of arrowColors) {
		defs.appendChild(makeArrowMarker(id, color));
		colorToMarkerId[color] = id;
	}

	svg.appendChild(defs);

	const fillGroup = document.createElementNS(SVG_NS, 'g');
	const outlineGroup = document.createElementNS(SVG_NS, 'g');
	svg.appendChild(fillGroup);
	svg.appendChild(outlineGroup);
	boardWrap.appendChild(svg);

	// square name → SVG top-left corner (white's perspective)
	function squareToXY(sq: string) {
		return { x: sq.charCodeAt(0) - 97, y: 7 - (parseInt(sq[1]) - 1) };
	}
	// square name → center point
	function squareCenter(sq: string) {
		const { x, y } = squareToXY(sq);
		return { cx: x + 0.5, cy: y + 0.5 };
	}

	// ---------------- Attack geometry ----------------
	// Returns attacked squares. For sliding pieces also returns the endpoint of each ray.
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

	// For arrows: sliding pieces return only the LAST square of each ray
	function getSlidingRayEndpoints(type: string, color: 'w' | 'b', square: string): string[] {
		const file = square.charCodeAt(0) - 97;
		const rank = parseInt(square[1]) - 1;
		const boardGrid = chess.board();
		const endpoints: string[] = [];

		const toSq = (f: number, r: number) => String.fromCharCode(97 + f) + (r + 1);
		const inBounds = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
		const pieceAt = (f: number, r: number) => boardGrid[7 - r]?.[f];

		const slideEnd = (df: number, dr: number) => {
			let f = file + df,
				r = rank + dr,
				last = '';
			while (inBounds(f, r)) {
				last = toSq(f, r);
				if (pieceAt(f, r)) break;
				f += df;
				r += dr;
			}
			if (last) endpoints.push(last);
		};

		const dirs: Record<string, number[][]> = {
			b: [
				[-1, -1],
				[-1, 1],
				[1, -1],
				[1, 1]
			],
			r: [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1]
			],
			q: [
				[-1, -1],
				[-1, 1],
				[1, -1],
				[1, 1],
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1]
			]
		};
		// only call for sliding pieces
		if (dirs[type]) dirs[type].forEach(([df, dr]) => slideEnd(df, dr));
		return endpoints;
	}

	// Map<square, { w: Set<pieceType>, b: Set<pieceType> }>
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

	// ---------------- SVG helpers ----------------
	function drawSquareOutline(x: number, y: number, color: string, inset: number) {
		const rect = document.createElementNS(SVG_NS, 'rect');
		rect.setAttribute('x', String(x + inset));
		rect.setAttribute('y', String(y + inset));
		rect.setAttribute('width', String(1 - inset * 2));
		rect.setAttribute('height', String(1 - inset * 2));
		rect.setAttribute('fill', 'none');
		rect.setAttribute('stroke', color);
		rect.setAttribute('stroke-width', '0.04');
		outlineGroup.appendChild(rect);
	}

	function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string) {
		// shorten the line a bit so arrowhead doesn't overlap the target square edge
		const markerId = colorToMarkerId[color] ?? 'arrow-red';
		const line = document.createElementNS(SVG_NS, 'line');
		line.setAttribute('x1', String(x1));
		line.setAttribute('y1', String(y1));
		line.setAttribute('x2', String(x2));
		line.setAttribute('y2', String(y2));
		line.setAttribute('stroke', color);
		line.setAttribute('stroke-width', '0.06');
		line.setAttribute('marker-end', `url(#${markerId})`);
		line.setAttribute('stroke-linecap', 'round');
		outlineGroup.appendChild(line);
	}

	function drawKnightCircle(sq: string, color: string) {
		const { cx, cy } = squareCenter(sq);
		const circle = document.createElementNS(SVG_NS, 'circle');
		circle.setAttribute('cx', String(cx));
		circle.setAttribute('cy', String(cy));
		circle.setAttribute('r', '0.175');
		circle.setAttribute('fill', 'none');
		circle.setAttribute('stroke', color);
		circle.setAttribute('stroke-width', '0.05');
		outlineGroup.appendChild(circle);
	}

	function drawKingSquare(sq: string, color: string) {
		const { cx, cy } = squareCenter(sq);
		const size = 0.3;
		const rect = document.createElementNS(SVG_NS, 'rect');
		rect.setAttribute('x', String(cx - size / 2));
		rect.setAttribute('y', String(cy - size / 2));
		rect.setAttribute('width', String(size));
		rect.setAttribute('height', String(size));
		rect.setAttribute('fill', 'none');
		rect.setAttribute('stroke', color);
		rect.setAttribute('stroke-width', '0.05');
		outlineGroup.appendChild(rect);
	}

	// ---------------- Render ----------------
	let currentSettings: OverlaySettings = { ...defaultSettings };

	function updateOverlay(settings: OverlaySettings) {
		currentSettings = settings;

		while (fillGroup.firstChild) fillGroup.removeChild(fillGroup.firstChild);
		while (outlineGroup.firstChild) outlineGroup.removeChild(outlineGroup.firstChild);

		// fills (always shown, independent of settings)
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

		// outlines / arrows — filtered by settings.side
		const showW = settings.side !== 'black';
		const showB = settings.side !== 'white';

		if (settings.style === 'squares') {
			// ---- SQUARES MODE ----
			const attackerMap = getAttackerMap();
			for (const [sq, { w, b }] of attackerMap) {
				const { x, y } = squareToXY(sq);
				const attackers: Array<{ color: 'w' | 'b'; type: string }> = [
					...(showW ? [...w].map((t) => ({ color: 'w' as const, type: t })) : []),
					...(showB ? [...b].map((t) => ({ color: 'b' as const, type: t })) : [])
				];
				attackers.forEach(({ color, type }, i) => {
					const inset = 0.04 + i * 0.07;
					const strokeColor = color === 'b' ? BLACK_COLOR : PIECE_COLOR[type];
					drawSquareOutline(x, y, strokeColor, inset);
				});
			}
		} else {
			// ---- ARROWS MODE ----
			for (const row of chess.board()) {
				for (const piece of row) {
					if (!piece) continue;
					const { color, type, square } = piece;
					if (color === 'w' && !showW) continue;
					if (color === 'b' && !showB) continue;

					const strokeColor = color === 'b' ? BLACK_COLOR : PIECE_COLOR[type];
					const { cx: px, cy: py } = squareCenter(square);

					if (type === 'n') {
						// knight → circle on each attacked square
						for (const sq of getPieceAttacks(type, color, square)) {
							drawKnightCircle(sq, strokeColor);
						}
					} else if (type === 'k') {
						// king → small square marker on each attacked square
						for (const sq of getPieceAttacks(type, color, square)) {
							drawKingSquare(sq, strokeColor);
						}
					} else if (type === 'p') {
						// pawn → short arrow to each diagonal
						for (const sq of getPieceAttacks(type, color, square)) {
							const { cx: tx, cy: ty } = squareCenter(sq);
							drawArrow(px, py, tx, ty, strokeColor);
						}
					} else {
						// sliding (b/r/q) → one arrow per ray to furthest square
						for (const sq of getSlidingRayEndpoints(type, color, square)) {
							const { cx: tx, cy: ty } = squareCenter(sq);
							drawArrow(px, py, tx, ty, strokeColor);
						}
					}
				}
			}
		}
	}

	return { enableInput, updateInfo, updateOverlay };
}
