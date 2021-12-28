const make_chessboard = async function(gl, phys_eng, obj_basedir = 'objects/') {
    // Append slash to basedir
    obj_basedir = obj_basedir + "/";

    // Checkerboard initial case position (relative to chessboard origin)
    const _checkerboard_offset  = glMatrix.vec3.fromValues(5.95, 1.2, -5.95);

    // Space between two squares in the checkerboard
    const _checkerboard_spacing = glMatrix.vec2.fromValues(-1.70, 1.70);

    // This list describes the number of each piece for a player
    const _game_pieces_composition = {
        p: 8, b: 2, r: 2, n: 2, q: 1, k: 1
    }


    // Convert game position to the 3D position for the piece
    function gameTo3DPosition(game_pos) {
        const chess_rotation = _chessboard.get_rotation();
        const final_pos = glMatrix.vec3.fromValues(
            (game_pos[1] - 1) * _checkerboard_spacing[0],
            0.0,
            (game_pos[0] - 1) * _checkerboard_spacing[1]
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

            return glMatrix.vec2.fromValues(pos_x+1, pos_z+1);
        }
        else {
            return null;
        }
    }

    // Convert letter position to game position (ie. B4 -> (2,4))
    function letterToGamePosition(letter_pos) {
        const letter_arr = letter_pos.toUpperCase().split('');
        return glMatrix.vec2.fromValues(letter_arr.charCodeAt(0) - 96, letter_arr[1]);
    }

    // Convert game to letter position (ie. (3,6) -> C6)
    function gameToLetterPosition(game_pos) {
        return String.fromCharCode(96 + game_pos[0]) + game_pos[1].toString();
    }

    async function setup_pieces(white_pieces, black_pieces) {
        const piece_meshes = {
            p: load_obj(obj_basedir + 'pawn.obj', false),
            b: load_obj(obj_basedir + 'bishop.obj', false),
            r: load_obj(obj_basedir + 'rock.obj', false),
            n: load_obj(obj_basedir + 'knight.obj', false),
            q: load_obj(obj_basedir + 'queen.obj', false),
            k: load_obj(obj_basedir + 'king.obj', false)
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
                const wp = await make_object(gl, piece_meshes[piece_type], null, null, white_material);
                //phys_eng.register_object(wp, 0.0);
                //wp.get_physics_body().setSleepingThresholds(5.0, 5.0);
                wp.piece_type   = piece_type;
                wp.piece_color  = 'w';
                wp.piece_pos    = null;
                white_pieces.push(wp);

                const bp = await make_object(gl, piece_meshes[piece_type], null, null, black_material);
                //phys_eng.register_object(bp, 0.0);
                bp.piece_type   = piece_type;
                bp.piece_color  = 'b';
                bp.piece_pos    = null;
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
                const square = chess_board[k][l];

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

    function set_position(pos) {
        _chessboard.set_position(pos);
        updatePieces3DPosition();
    }

    function set_rotationY(angle) {
        const y_axis = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
        _chessboard.set_rotation(y_axis, angle);
        updatePieces3DPosition();
    }

    // First, load and create all chess pieces and the chessboard
    const chessboard_mesh = load_obj(obj_basedir + 'chessboard.obj');
    const _chessboard = await make_object(gl, chessboard_mesh);
    phys_eng.register_object(_chessboard, 0.0);

    const _pieces_white = [];
    const _pieces_black = [];

    const _chess_js_inst = new Chess();

    await setup_pieces(_pieces_white, _pieces_black);
    setChessPiecesPosition(_chess_js_inst, _pieces_white, _pieces_black);

    return {
        draw: draw,
        set_position: set_position,
        set_rotationY: set_rotationY,
        squareFrom3DPosition: squareFrom3DPosition,
        gameToLetterPosition: gameToLetterPosition
    }
};