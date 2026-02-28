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
	updateOverlay: (settings: OverlaySettings, excludeSquare?: string) => void;
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
				if (moves.length > 0) {
					updateOverlay(currentSettings, event.squareFrom);
				}
				return moves.length > 0;
			}
			case INPUT_EVENT_TYPE.validateMoveInput: {
				board.removeLegalMovesMarkers();
				updateOverlay(currentSettings);
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
				updateOverlay(currentSettings);
				break;
		}
		return true;
	}

	// ---------------- Overlay ----------------
	const SVG_NS = 'http://www.w3.org/2000/svg';

	const PIECE_COLOR: Record<string, string> = {
		p: '#b088ff',
		n: '#00d4ff',
		b: '#00d4ff',
		r: '#ff00cc',
		q: '#ff00cc',
		k: '#ffe500'
	};
	const BLACK_COLOR = '#b5412d';

	boardEl.style.position = 'relative';

	// ---------------- Two SVG layers ----------------
	// fillGroup → injected INTO cm-chessboard's SVG, after the board squares, UNDER pieces
	// outlineGroup → our own SVG on top of everything (outlines, badges, arrows)

	const fillGroup = document.createElementNS(SVG_NS, 'g');
	fillGroup.setAttribute('class', 'overlay-fills');

	// Our top SVG — outlines and badges only
	const topSvg = document.createElementNS(SVG_NS, 'svg');
	topSvg.setAttribute('viewBox', '0 0 8 8');
	topSvg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

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
		['arrow-brown', '#b5412d']
	] as const;

	const colorToMarkerId: Record<string, string> = {};
	for (const [id, color] of arrowColors) {
		defs.appendChild(makeArrowMarker(id, color));
		colorToMarkerId[color] = id;
	}

	topSvg.appendChild(defs);
	const outlineGroup = document.createElementNS(SVG_NS, 'g');
	topSvg.appendChild(outlineGroup);
	boardEl.appendChild(topSvg);

	// Inject fillGroup into cm-chessboard's own SVG, right after the board squares group
	// This puts fills UNDER pieces automatically since pieces-layer comes after in the SVG
	const boardSvg = boardEl.querySelector('svg');
	const boardGroup = boardSvg?.querySelector('g.board');
	if (boardSvg && boardGroup) {
		// fillGroup needs its own viewBox-aware coordinate system
		// cm-chessboard uses pixel coords, so we use a nested SVG with our 0-8 viewBox
		const fillSvg = document.createElementNS(SVG_NS, 'svg');
		fillSvg.setAttribute('width', '100%');
		fillSvg.setAttribute('height', '100%');
		fillSvg.setAttribute('viewBox', '0 0 8 8');
		fillSvg.style.pointerEvents = 'none';
		fillSvg.appendChild(fillGroup);
		boardSvg.insertBefore(fillSvg, boardGroup.nextSibling);
	}

	// ---------------- Coordinate helpers ----------------
	function squareToXY(sq: string) {
		return { x: sq.charCodeAt(0) - 97, y: 7 - (parseInt(sq[1]) - 1) };
	}
	function squareCenter(sq: string) {
		const { x, y } = squareToXY(sq);
		return { cx: x + 0.5, cy: y + 0.5 };
	}

	// ---------------- Attack geometry ----------------
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
		if (dirs[type]) dirs[type].forEach(([df, dr]) => slideEnd(df, dr));
		return endpoints;
	}

	function getAttackerMap(excludeSquare?: string) {
		const map = new Map<string, { w: Set<string>; b: Set<string> }>();
		const ensure = (sq: string) => {
			if (!map.has(sq)) map.set(sq, { w: new Set(), b: new Set() });
			return map.get(sq)!;
		};
		for (const row of chess.board()) {
			for (const piece of row) {
				if (!piece) continue;
				if (piece.square === excludeSquare) continue;
				for (const sq of getPieceAttacks(piece.type, piece.color, piece.square)) {
					ensure(sq)[piece.color].add(piece.type);
				}
			}
		}
		return map;
	}

	// ---------------- SVG draw helpers ----------------
	function drawMultiColorOutline(x: number, y: number, colors: string[]) {
		const inset = 0.05;
		const segLen = 0.15;
		colors.forEach((color, i) => {
			const rect = document.createElementNS(SVG_NS, 'rect');
			rect.setAttribute('x', String(x + inset));
			rect.setAttribute('y', String(y + inset));
			rect.setAttribute('width', String(1 - inset * 2));
			rect.setAttribute('height', String(1 - inset * 2));
			rect.setAttribute('fill', 'none');
			rect.setAttribute('stroke', color);
			rect.setAttribute('stroke-width', '0.04');
			rect.setAttribute('stroke-dasharray', `${segLen} ${(colors.length - 1) * segLen}`);
			rect.setAttribute('stroke-dashoffset', String(-i * segLen));
			outlineGroup.appendChild(rect);
		});
	}

	function drawBadge(
		x: number,
		y: number,
		count: number,
		bg: string,
		fg: string,
		corner: 'tl' | 'tr'
	) {
		const r = 0.16;
		const cx = corner === 'tl' ? x + r + 0.04 : x + 1 - r - 0.04;
		const cy = y + r + 0.04;
		const circle = document.createElementNS(SVG_NS, 'circle');
		circle.setAttribute('cx', String(cx));
		circle.setAttribute('cy', String(cy));
		circle.setAttribute('r', String(r));
		circle.setAttribute('fill', bg);
		outlineGroup.appendChild(circle);
		const text = document.createElementNS(SVG_NS, 'text');
		text.setAttribute('x', String(cx));
		text.setAttribute('y', String(cy));
		text.setAttribute('text-anchor', 'middle');
		text.setAttribute('dominant-baseline', 'central');
		text.setAttribute('font-size', '0.22');
		text.setAttribute('font-weight', 'bold');
		text.setAttribute('fill', fg);
		text.textContent = String(count);
		outlineGroup.appendChild(text);
	}

	function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string) {
		const markerId = colorToMarkerId[color] ?? 'arrow-brown';
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

	function updateOverlay(settings: OverlaySettings, excludeSquare?: string) {
		currentSettings = settings;

		while (fillGroup.firstChild) fillGroup.removeChild(fillGroup.firstChild);
		while (outlineGroup.firstChild) outlineGroup.removeChild(outlineGroup.firstChild);

		const attackerMap = getAttackerMap(excludeSquare);

		// fills — drawn into cm-chessboard's SVG, under pieces
		for (const [sq, { w, b }] of attackerMap) {
			const inW = w.size > 0,
				inB = b.size > 0;
			if (!inW && !inB) continue;
			const { x, y } = squareToXY(sq);
			const rect = document.createElementNS(SVG_NS, 'rect');
			rect.setAttribute('x', String(x));
			rect.setAttribute('y', String(y));
			rect.setAttribute('width', '1');
			rect.setAttribute('height', '1');
			rect.setAttribute(
				'fill',
				inW && inB ? 'url(#hatch-both)' : inW ? 'rgba(80,200,80,0.35)' : 'rgba(220,60,60,0.35)'
			);
			fillGroup.appendChild(rect);
		}

		const showW = settings.side !== 'black';

		if (settings.style === 'squares') {
			for (const [sq, { w, b }] of attackerMap) {
				const { x, y } = squareToXY(sq);
				const colors: string[] = [
					...(showW ? [...w].map((t) => PIECE_COLOR[t]) : []),
					...(b.size > 0 ? [BLACK_COLOR] : [])
				];
				const uniqueColors = [...new Set(colors)];
				if (uniqueColors.length > 0) drawMultiColorOutline(x, y, uniqueColors);

				if (w.size > 0 && b.size > 0) {
					if (showW) drawBadge(x, y, w.size, '#ffffff', '#111111', 'tl');
					drawBadge(x, y, b.size, '#111111', '#ffffff', 'tr');
				}
			}
		} else {
			for (const row of chess.board()) {
				for (const piece of row) {
					if (!piece) continue;
					if (piece.square === excludeSquare) continue;
					const { color, type, square } = piece;
					if (color === 'w' && !showW) continue;

					const strokeColor = color === 'b' ? BLACK_COLOR : PIECE_COLOR[type];
					const { cx: px, cy: py } = squareCenter(square);

					if (type === 'n') {
						for (const sq of getPieceAttacks(type, color, square))
							drawKnightCircle(sq, strokeColor);
					} else if (type === 'k') {
						for (const sq of getPieceAttacks(type, color, square)) drawKingSquare(sq, strokeColor);
					} else if (type === 'p') {
						for (const sq of getPieceAttacks(type, color, square)) {
							const { cx: tx, cy: ty } = squareCenter(sq);
							drawArrow(px, py, tx, ty, strokeColor);
						}
					} else {
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
