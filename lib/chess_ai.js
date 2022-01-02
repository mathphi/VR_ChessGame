/*
 * Chess game AI algorithm
 *
 * Credits: https://github.com/gautambajaj/Chess-AI
 */

function makeAI(analysis_depth, cjs_inst) {

    let _depth = analysis_depth;
    let _game_inst = cjs_inst;

    function setAnalysisDepth(depth) {
        _depth = depth;
    }

    function findBestMove(){
        const next_possible_moves = _game_inst.moves({verbose:true});
        let best_move_value = -9999;
        let best_move = null;

        for(const move of next_possible_moves) {
            _game_inst.move(move);
            const value = minimax(_depth, -10000, 10000, false);
            _game_inst.undo();
            if(value >= best_move_value) {
                best_move_value = value;
                best_move = move;
            }
        }
        return best_move;
    }

    function minimax(depth, alpha, beta, isMaximisingPlayer) {
        let best_move;
        if (depth === 0) {
            return -evaluateBoard(_game_inst.board());
        }

        const next_possible_moves = _game_inst.moves();

        if (isMaximisingPlayer) {
            best_move = -9999;
            for (let move of next_possible_moves) {
                _game_inst.move(move);
                best_move = Math.max(best_move, minimax(depth - 1, alpha, beta, !isMaximisingPlayer));
                _game_inst.undo();
                alpha = Math.max(alpha, best_move);
                if(beta <= alpha){
                    return best_move;
                }
            }

        } else {
            best_move = 9999;
            for (let move of next_possible_moves) {
                _game_inst.move(move);
                best_move = Math.min(best_move, minimax(depth - 1, alpha, beta, !isMaximisingPlayer));
                _game_inst.undo();
                beta = Math.min(beta, best_move);
                if(beta <= alpha){
                    return best_move;
                }
            }
        }

        return best_move;
    }

    function evaluateBoard(board) {
        let total_evaluation = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                total_evaluation = total_evaluation + getPieceValue(board[i][j], i, j);
            }
        }
        return total_evaluation;
    }

    function getPieceValue(piece, x, y) {
        if (piece === null) {
            return 0;
        }

        const absolute_value = getAbsoluteValue(piece, piece.color === 'w', x ,y);

        if(piece.color === 'w'){
            return absolute_value;
        } else {
            return -absolute_value;
        }
    }

    function getAbsoluteValue(piece, is_white, x ,y) {
        if (piece.type === 'p') {
            return 10 + ( is_white ? white_pawn_eval[y][x] : black_pawn_eval[y][x] );
        } else if (piece.type === 'r') {
            return 50 + ( is_white ? white_rook_eval[y][x] : black_rook_eval[y][x] );
        } else if (piece.type === 'n') {
            return 30 + knight_eval[y][x];
        } else if (piece.type === 'b') {
            return 30 + ( is_white ? white_bishop_eval[y][x] : black_bishop_eval[y][x] );
        } else if (piece.type === 'q') {
            return 90 + eval_queen[y][x];
        } else if (piece.type === 'k') {
            return 900 + ( is_white ? white_king_eval[y][x] : black_king_eval[y][x] );
        }
    }

    function reverseArray(array) {
        return array.slice().reverse();
    }

    const white_pawn_eval =
        [
            [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
            [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
            [1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
            [0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
            [0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
            [0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
            [0.5,  1.0,  1.0,  -2.0, -2.0,  1.0,  1.0,  0.5],
            [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
        ];

    const black_pawn_eval = reverseArray(white_pawn_eval);

    const knight_eval =
        [
            [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
            [-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
            [-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
            [-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
            [-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
            [-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
            [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
            [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
        ];

    const white_bishop_eval = [
        [ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
        [ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
        [ -1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
        [ -1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
        [ -1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
        [ -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
        [ -1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
        [ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
    ];

    const black_bishop_eval = reverseArray(white_bishop_eval);

    const white_rook_eval = [
        [  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
        [  0.5,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  0.5],
        [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
        [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
        [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
        [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
        [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
        [  0.0,   0.0, 0.0,  0.5,  0.5,  0.0,  0.0,  0.0]
    ];

    const black_rook_eval = reverseArray(white_rook_eval);

    const eval_queen = [
        [ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
        [ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
        [ -1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
        [ -0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
        [  0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
        [ -1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
        [ -1.0,  0.0,  0.5,  0.0,  0.0,  0.0,  0.0, -1.0],
        [ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
    ];

    const white_king_eval = [
        [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [ -2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
        [ -1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
        [  2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0 ],
        [  2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0 ]
    ];

    const black_king_eval = reverseArray(white_king_eval);

    return{
        findBestMove: findBestMove,
        setAnalysisDepth: setAnalysisDepth,
    }
}