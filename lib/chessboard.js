const make_chessboard = async function(gl, phys_eng, basedir = '.') {
    // Checkerboard initial case position (relative to chessboard origin)
    const _checkerboard_offset  = glMatrix.vec3.fromValues(5.95, 1.1, -5.95);

    // Space between two squares in the checkerboard
    const _checkerboard_spacing = glMatrix.vec2.fromValues(-1.70, 1.70);

    // This list describes the number of each piece for a player
    const _game_pieces_composition = {
        p: 8, b: 2, r: 2, n: 2, q: 1, k: 1
    }

    const _move_square_color_default = glMatrix.vec3.fromValues(1.0, 1.0, 0.0);
    const _move_square_color_hover   = glMatrix.vec3.fromValues(0.2, 1.0, 0.1);

    function vec2equals(v1, v2) {
        let diff = false;
        diff |= (v1 === null && v2 !== null);
        diff |= (v1 !== null && v2 === null);
        diff |= (v1 !== null && v2 !== null && !glMatrix.vec2.equals(v1, v2));
        return !diff;
    }

    function set_position(pos) {
        _chessboard.set_position(pos);
        updatePieces3DPosition();
        updateMoveSquaresPosition();
    }

    function set_rotationY(angle) {
        const y_axis = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
        _chessboard.set_rotation(y_axis, angle);
        updatePieces3DPosition();
        updateMoveSquaresPosition();
    }

    // Convert game position to the 3D position for the piece
    function gameTo3DPosition(game_pos) {
        const chess_rotation = _chessboard.get_rotation();
        const final_pos = glMatrix.vec3.fromValues(
            (game_pos[0] - 1) * _checkerboard_spacing[0],
            0.0,
            (game_pos[1] - 1) * _checkerboard_spacing[1]
        );
        glMatrix.vec3.add(final_pos, final_pos, _checkerboard_offset);
        glMatrix.vec3.transformQuat(final_pos, final_pos, chess_rotation);
        glMatrix.vec3.add(final_pos, final_pos, _chessboard.get_position());

        return final_pos;
    }

    function squareFrom3DPosition(position) {
        const delta_pos = _chessboard.get_position();
        const chess_rotation = _chessboard.get_rotation();

        // Delta_pos = position - chess_position
        glMatrix.vec3.sub(delta_pos, position, delta_pos);

        // Invert the quaternions of chess rotation
        glMatrix.quat.invert(chess_rotation, chess_rotation);

        // Rotate the delta_pos vector by inverse of rotation of chessboard
        glMatrix.vec3.transformQuat(delta_pos, delta_pos, chess_rotation);

        // Translate to origin of coordinates
        glMatrix.vec3.sub(delta_pos, delta_pos, _checkerboard_offset);

        // Ok only if Y position close to checkerboard surface
        if (Math.abs(delta_pos[1]) < 0.2) {
            const pos_x = Math.round(delta_pos[0] / _checkerboard_spacing[0]);
            const pos_z = Math.round(delta_pos[2] / _checkerboard_spacing[1]);

            if (pos_x >= 0 && pos_x < 8 && pos_z >= 0 && pos_z < 8) {
                return glMatrix.vec2.fromValues(pos_x + 1, pos_z + 1);
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }

    // Convert letter position to game position (ie. b4 -> (2,4))
    function letterToGamePosition(letter_pos) {
        const letter_arr = letter_pos.toLowerCase().split('');
        return glMatrix.vec2.fromValues(letter_arr[0].charCodeAt(0) - 96, letter_arr[1]);
    }

    // Convert game to letter position (ie. (3,6) -> c6)
    function gameToLetterPosition(game_pos) {
        return String.fromCharCode(96 + game_pos[0]) + game_pos[1].toString();
    }

    async function setupPieces(white_pieces, black_pieces) {
        const piece_meshes = {
            p: load_obj(basedir + '/objects/pieces/pawn.obj', false),
            b: load_obj(basedir + '/objects/pieces/bishop.obj', false),
            r: load_obj(basedir + '/objects/pieces/rook.obj', false),
            n: load_obj(basedir + '/objects/pieces/knight.obj', false),
            q: load_obj(basedir + '/objects/pieces/queen.obj', false),
            k: load_obj(basedir + '/objects/pieces/king.obj', false)
        }
        const piece_cboxes = {
            p: load_obj(basedir + '/objects/collision_boxes/c_pawn.obj', false),
            b: load_obj(basedir + '/objects/collision_boxes/c_bishop.obj', false),
            r: load_obj(basedir + '/objects/collision_boxes/c_rook.obj', false),
            n: load_obj(basedir + '/objects/collision_boxes/c_knight.obj', false),
            q: load_obj(basedir + '/objects/collision_boxes/c_queen.obj', false),
            k: load_obj(basedir + '/objects/collision_boxes/c_king.obj', false)
        }

        const white_material = make_material('white_piece');
        white_material.set_reflection(0.8);
        white_material.set_specular(100.0, 1.0);

        const black_material = make_material('black_piece');
        black_material.set_color(glMatrix.vec3.fromValues(0.0, 0.0, 0.0));
        black_material.set_reflection(0.3);
        black_material.set_specular(100.0, 1.0);

        // Generate the right amount of pieces for each player
        for (const [piece_type, piece_count] of Object.entries(_game_pieces_composition)) {
            for (let i = 0 ; i < piece_count ; i++) {
                const col_mesh = await piece_cboxes[piece_type];
                const wp = await make_object(gl, piece_meshes[piece_type], null, null, white_material);
                phys_eng.register_object(wp, 0.0, col_mesh);
                wp.piece_type   = piece_type;
                wp.piece_color  = 'w';
                wp.piece_pos    = null;
                wp.from_chess   = true;
                white_pieces.push(wp);

                const bp = await make_object(gl, piece_meshes[piece_type], null, null, black_material);
                phys_eng.register_object(bp, 0.0, col_mesh);
                bp.piece_type   = piece_type;
                bp.piece_color  = 'b';
                bp.piece_pos    = null;
                bp.from_chess   = true;
                black_pieces.push(bp);
            }
        }
    }

    function setChessPiecesPosition(cjs, white_pieces, black_pieces) {
        const chess_board = cjs.board();

        // Reset the position of all pieces (to null)
        for (let i = 0 ; i < white_pieces.length ; i++) {
            white_pieces[i].piece_pos = null;
            black_pieces[i].piece_pos = null;
        }

        // Loop over each square and check which piece must be placed on it
        for (let k = 0 ; k < 8 ; k++) {
            for (let l = 0 ; l < 8 ; l++) {
                const square = chess_board[l][k];

                // Skip if no piece must be placed
                if (square === null)
                    continue;

                const game_pos   = glMatrix.vec2.fromValues(k+1, l+1);
                const piece_list = (square.color === 'b') ? white_pieces : black_pieces;

                // Check for a piece of this type and not placed yet
                for (let i = 0 ; i < piece_list.length ; i++) {
                    const piece = piece_list[i];

                    // If we found the right piece, set its position and exit this loop
                    if (piece.piece_pos === null && piece.piece_type === square.type) {
                        piece.piece_pos = game_pos;
                        break;
                    }
                }
            }
        }

        updatePieces3DPosition();
    }

    function updatePieces3DPosition() {
        const y_axis = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
        const chess_rotation = _chessboard.get_rotation();

        for (let i = 0 ; i < _pieces_white.length ; i++) {
            if (_pieces_white[i].piece_pos !== null) {
                _pieces_white[i].set_position(gameTo3DPosition(_pieces_white[i].piece_pos));
                _pieces_white[i].set_rotation_quat(chess_rotation);
                _pieces_white[i].rotate(y_axis, -Math.PI/2.0);
            }

            if (_pieces_black[i].piece_pos !== null) {
                _pieces_black[i].set_position(gameTo3DPosition(_pieces_black[i].piece_pos));
                _pieces_black[i].set_rotation_quat(chess_rotation);
                _pieces_black[i].rotate(y_axis, -Math.PI - Math.PI/2.0);

            }
        }
    }

    async function setupMoveSquares() {
        const ms_mesh = load_obj(basedir + '/objects/square_plane.obj', false);

        for (let k = 0 ; k < 8 ; k++) {
            // Allocate array memory at once
            _move_squares[k] = new Array(8).fill(null);

            for (let l = 0 ; l < 8 ; l++) {
                // Each move square has its own material (not a shared copy)
                const ms_material = make_material(
                    'ms',
                    _move_square_color_default,
                    0.0, 0.0
                );

                _move_squares[k][l] = await make_object(gl, ms_mesh, null, null, ms_material);
            }
        }
    }

    function updateMoveSquaresPosition() {
        const chess_rotation = _chessboard.get_rotation();

        for (let k = 0 ; k < 8 ; k++) {
            for (let l = 0; l < 8; l++) {
                const move_sq = _move_squares[k][l];
                move_sq.set_position(gameTo3DPosition(
                    glMatrix.vec2.fromValues(k+1, l+1)
                ));
                move_sq.set_rotation_quat(chess_rotation);
            }
        }
    }

    function determineVisibleMoveSquares(query_square) {
        // Get all the available moves for this square
        const moves = _chess_js_inst.moves({square: query_square, verbose: true});

        // Reset the possible moves list
        _possible_moves = [];

        for (const move of moves) {
            _possible_moves.push(letterToGamePosition(move.to));
        }
    }

    function setChessPieceSelection(new_select) {
        const current_select_piece = _selected_piece;

        if (current_select_piece !== null) {
            // Move back to initial position
            _selected_piece.anim_to_position(gameTo3DPosition(_selected_piece.piece_pos), 500.0);
            _selected_piece = null;
        }

        if (current_select_piece !== new_select) {
            // Move upward
            const new_pos = gameTo3DPosition(new_select.piece_pos);
            glMatrix.vec3.add(new_pos, new_pos, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));
            new_select.anim_to_position(new_pos, 500.0);
            _selected_piece = new_select;
        }
    }

    function draw(shader) {
        _chessboard.draw(shader);

        for (let i = 0 ; i < _pieces_white.length ; i++) {
            const piece_w = _pieces_white[i];
            if (piece_w.piece_pos !== null) {
                piece_w.draw(shader);
            }

            const piece_b = _pieces_black[i];
            if (piece_b.piece_pos !== null) {
                piece_b.draw(shader);
            }
        }
    }

    function draw_move_squares(shader) {
        for (const pm of _possible_moves) {
            _move_squares[pm[0]-1][pm[1]-1].draw(shader);
        }
    }

    function on_chess_clicked(picked_object, picked_position) {
        let san_pos;
        if (picked_object === _chessboard) {
            const game_pos = squareFrom3DPosition(picked_position);
            san_pos = gameToLetterPosition(game_pos);
            if (game_pos !== null) {
                console.log("Chessboard clicked at: " + san_pos);
            }
        }
        else {
            san_pos = gameToLetterPosition(picked_object.piece_pos);
            console.log(`Piece clicked: ${picked_object.piece_type}, ${picked_object.piece_color} at ${san_pos}`);

            setChessPieceSelection(picked_object);
        }
    }

    let prev_hover_object   = null;
    let prev_hover_san_pos = null;
    function on_chess_hover(picked_object, picked_position) {
        const prev_game_pos = (prev_hover_san_pos === null) ? null : letterToGamePosition(prev_hover_san_pos);

        // Unhighlight the previously hovered piece
        if (prev_hover_object !== picked_object && prev_hover_object !== null) {
            prev_hover_object.set_highlighted(false);

            if (_selected_piece === null) {
                // Show corresponding move squares
                determineVisibleMoveSquares(null);
            }
        }

        const turn_color = _chess_js_inst.turn();
        let san_pos;
        let game_pos;

        if (picked_object === _chessboard) {
            game_pos = squareFrom3DPosition(picked_position);
            san_pos = (game_pos === null) ? null : gameToLetterPosition(game_pos);

            if (san_pos !== null && (prev_hover_san_pos !== san_pos || prev_hover_object !== picked_object)) {
                console.log("Chessboard hover at: " + san_pos);
            }
        }
        else {
            san_pos = gameToLetterPosition(picked_object.piece_pos);
            game_pos = letterToGamePosition(san_pos);

            if (prev_hover_object !== picked_object) {
                if (picked_object.piece_color === turn_color) {
                    // Highlight the hovered piece
                    picked_object.set_highlighted(true);

                    if (_selected_piece === null) {
                        // Show corresponding move squares
                        determineVisibleMoveSquares(san_pos);
                    }
                }

                console.log(`Piece hover at ${san_pos}: ${picked_object.piece_type}, ${picked_object.piece_color}`);
            }
        }

        if (prev_hover_san_pos !== san_pos) {
            if (game_pos !== null) {
                // Change hovered move square color
                _move_squares[game_pos[0] - 1][game_pos[1] - 1].materials['ms'].set_color(
                    _move_square_color_hover
                );
                const pos = gameTo3DPosition(game_pos);
                glMatrix.vec3.add(pos, pos, glMatrix.vec3.fromValues(0.0,0.01,0.0));
                _move_squares[game_pos[0] - 1][game_pos[1] - 1].set_position(pos);
            }

            if (prev_hover_san_pos !== null) {
                // Reset color of the previously hovered move square
                _move_squares[prev_game_pos[0] - 1][prev_game_pos[1] - 1].materials['ms'].set_color(
                    _move_square_color_default
                );
                const pos = gameTo3DPosition(prev_game_pos);
                _move_squares[prev_game_pos[0] - 1][prev_game_pos[1] - 1].set_position(pos);
            }
        }

        prev_hover_san_pos = san_pos;
        prev_hover_object = picked_object;
    }

    // First, load and create all chess pieces and the chessboard
    const chessboard_mesh = load_obj(basedir + '/objects/chessboard.obj');
    const _chessboard = await make_object(gl, chessboard_mesh);
    phys_eng.register_object(_chessboard, 0.0);
    _chessboard.from_chess = true;

    const _pieces_white = [];
    const _pieces_black = [];
    let _selected_piece = null;

    const _move_squares = new Array(8).fill(null);
    let _possible_moves = [];

    const _chess_js_inst = new Chess();


    await setupPieces(_pieces_white, _pieces_black);
    setChessPiecesPosition(_chess_js_inst, _pieces_white, _pieces_black);

    await setupMoveSquares();
    updateMoveSquaresPosition();

    return {
        draw: draw,
        draw_move_squares: draw_move_squares,
        set_position: set_position,
        set_rotationY: set_rotationY,
        squareFrom3DPosition: squareFrom3DPosition,
        gameToLetterPosition: gameToLetterPosition,
        on_chess_clicked: on_chess_clicked,
        on_chess_hover: on_chess_hover
    }
};