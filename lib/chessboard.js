const make_chessboard = async function(gl, phys_eng, lights_set, basedir = '.') {
    // Checkerboard initial case position (relative to chessboard origin)
    const _checkerboard_offset  = glMatrix.vec3.fromValues(5.95, 1.1, -5.95);

    // Space between two squares in the checkerboard
    const _checkerboard_spacing = glMatrix.vec2.fromValues(-1.70, 1.70);

    // This list describes the number of each piece for a player
    const _game_pieces_composition = {
        p: 8, b: 2, r: 2, n: 2, q: 1, k: 1
    }

    // Mass of the piece
    const _piece_mass = 1.0;

    // Move square colors
    const _move_square_color_default = glMatrix.vec3.fromValues(1.0, 1.0, 0.0);
    const _move_square_color_hover   = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
    const _move_square_color_capture = glMatrix.vec3.fromValues(1.0, 0.5, 0.0);

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
            game_pos[0] * _checkerboard_spacing[0],
            0.0,
            game_pos[1] * _checkerboard_spacing[1]
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
                return glMatrix.vec2.fromValues(pos_x, pos_z);
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
        return glMatrix.vec2.fromValues(letter_arr[0].charCodeAt(0) - 97, letter_arr[1]-1);
    }

    // Convert game to letter position (ie. (3,6) -> c6)
    function gameToLetterPosition(game_pos) {
        return String.fromCharCode(97 + game_pos[0]) + (game_pos[1]+1).toString();
    }

    // Returns the chess piece at the given game position
    function getPieceAtPosition(game_pos) {
        for (const piece of _pieces_white.concat(_pieces_black)) {
            if (vec2equals(piece.piece_pos, game_pos)) {
                return piece;
            }
        }

        return null;
    }

    // Returns the color of the given square
    function getSquareColor(game_pos) {
        const sum = game_pos[0] + game_pos[1];
        return (sum % 2 === 0) ? 'b' : 'w';
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

                const game_pos   = glMatrix.vec2.fromValues(k, l);
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
                    glMatrix.vec2.fromValues(k, l)
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

        // Update their position (in case the board moved)
        updateMoveSquaresPosition();
    }

    function setChessPieceSelection(new_select) {
        // Abort if the piece is owned by the wrong player
        if (new_select.piece_color !== _chess_js_inst.turn())
            return;

        // Save it for later use
        const current_select_piece = _selected_piece;

        if (current_select_piece !== null) {
            // Move back to initial position
            _selected_piece.anim_to_position(gameTo3DPosition(_selected_piece.piece_pos), 500.0);
            _selected_piece = null;
            
            setSelectionLight(null);
        }

        if (current_select_piece !== new_select) {
            // Move upward
            const new_pos = gameTo3DPosition(new_select.piece_pos);
            glMatrix.vec3.add(new_pos, new_pos, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));
            new_select.anim_to_position(new_pos, 500.0);
            _selected_piece = new_select;

            // Determine move squares to show
            determineVisibleMoveSquares(gameToLetterPosition(new_select.piece_pos));

            // Turn on selection light above the piece
            setSelectionLight(new_select.piece_pos);
        }
    }

    function processBoardClick(click_pos) {
        // Cancel if no piece is selected
        if (_selected_piece === null || click_pos === null)
            return;

        // Get the position of the selected piece
        const select_pos = _selected_piece.piece_pos;
        const select_pos_san = gameToLetterPosition(select_pos);

        // Get the position of the playing piece
        const target_pos_san = gameToLetterPosition(click_pos);

        // Get possible moves end positions in a list
        const possible_moves = _chess_js_inst.moves({square: select_pos_san, verbose: true});

        for (const move of possible_moves) {
            // Check if the clicked position is one of the possible move endpoints
            if (move.to !== target_pos_san) {
                continue;
            }

            console.log(`Processing move:`);
            console.log(move);

            // Move success flag
            let move_success = false;

            // If this is a possible move, check if it is a simple move, a capture, a promotion,...
            if (move.flags.includes('n') || move.flags.includes('b')) {
                // Non-capture or Pawn push of two squares
                move_success = processPieceMove(click_pos);
            }
            else if (move.flags.includes('c')) {
                // Standard capture
                move_success = processPieceCapture(move);
            }
            else if (move.flags.includes('e')) {
                // En passant

            }
            else if (move.flags.includes('k')) {
                // Kingside castling

            }
            else if (move.flags.includes('q')) {
                // Queenside castling

            }
            else {
                // Ooops...
                console.warn(`Unable to process the move (unknown flags: ${move.flags})`);
            }

            //TODO: move this inside capture and non capture (np and cp)
            if (move.flags.includes('p')) {
                // Promotion (combined with others)

            }

            // If something went wrong...
            if (!move_success) {
                // Go back to normal position
                const target_3d_pos = gameTo3DPosition(_selected_piece.piece_pos);
                _selected_piece.anim_to_position(target_3d_pos, 500.0);
            }

            // Hide the move squares
            determineVisibleMoveSquares(null);

            // Hide spotlight
            setSelectionLight(null);

            // Unselect the piece
            _selected_piece = null;

            //TODO: now we should check if there is a check, checkmate,...
            //TODO: also, the player changes here, we can fire an event...

            return;
        }
    }

    function processPieceMove(target_pos) {
        // Convert positions
        const from_pos_san = gameToLetterPosition(_selected_piece.piece_pos);
        const target_pos_san = gameToLetterPosition(target_pos);

        // Process the move in game logic
        const move_result = _chess_js_inst.move({from: from_pos_san, to: target_pos_san});

        if (move_result !== null) {
            // If all was done correctly, the move is valid, and we can animate
            const target_3d_pos = gameTo3DPosition(target_pos);
            _selected_piece.anim_move_above_pos(target_3d_pos, 2.0, 750.0);

            if(_sound_on) {setTimeout(function(){_chess_sound.play();}, 500);}

            // Set the new game position of the piece
            _selected_piece.piece_pos = target_pos;

            return true;
        }
        else {
            // Oooooops...
            console.warn(`Invalid move: from '${from_pos_san}' to '${target_pos_san}' !!!`);
            return false;
        }
    }

    function processPieceCapture(move_data) {
        const from_pos = letterToGamePosition(move_data.from);
        const target_pos = letterToGamePosition(move_data.to);

        // Retrieve captured piece to act on it
        const selected_piece = _selected_piece;
        const captured_piece = getPieceAtPosition(target_pos);

        // Process the move in game logic
        const move_result = _chess_js_inst.move({from: move_data.from, to: move_data.to});

        if (move_result !== null && captured_piece !== null) {
            // If all was done correctly, the move is valid, and we can animate

            // Callback functions
            function final_anim() {
                selected_piece.anim_to_position(end_3d_pos, 500.0);
            }
            function destructor_force() {
                const force = glMatrix.vec3.create();
                glMatrix.vec3.scale(force, delta_pos_n, 100.0); // Apply a factor to increase the force

                captured_piece.get_physics_body().applyForce(
                    new Ammo.btVector3(force[0], force[1], force[2]),
                    new Ammo.btVector3(0.0, 1.5, 0.0)
                );
            }
            function handle_captured() {
                buryCapturedPiece(captured_piece);
            }

            // Apply physics on the target piece
            captured_piece.set_physics_mass(_piece_mass);
            captured_piece.get_physics_body().activate(false);
            selected_piece.get_physics_body().activate(false);

            // Get start and end world positions
            const start_3d_pos = gameTo3DPosition(from_pos);
            const end_3d_pos = gameTo3DPosition(target_pos);

            // Get the normalized delta_pos vector
            const delta_pos_n = glMatrix.vec3.create();
            glMatrix.vec3.sub(delta_pos_n, end_3d_pos, start_3d_pos);
            glMatrix.vec3.normalize(delta_pos_n, delta_pos_n);

            // Determine the movement curve
            const init_pos   = selected_piece.get_position();
            const tmp_vect   = glMatrix.vec3.create();
            const inter_pos1 = glMatrix.vec3.create();
            const inter_pos2 = glMatrix.vec3.create();

            // The intermediate positions are the initial positions shifted
            glMatrix.vec3.add(inter_pos1, init_pos, delta_pos_n);
            glMatrix.vec3.add(inter_pos1, inter_pos1, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));

            // Intermediate position 2
            glMatrix.vec3.scale(tmp_vect, delta_pos_n, 0.5);
            glMatrix.vec3.sub(inter_pos2, end_3d_pos, tmp_vect);
            glMatrix.vec3.add(inter_pos2, inter_pos2, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));

            // End position is above the square, and final_anim will place the piece on its final position
            glMatrix.vec3.add(tmp_vect, end_3d_pos, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));

            // Start movement and animation
            const duration = 500.0;
            selected_piece.anim_move_bezier_curve(
                init_pos,
                inter_pos1,
                inter_pos2,
                tmp_vect,
                duration,
                final_anim
            );
            setTimeout(destructor_force, duration - 100.0);
            setTimeout(handle_captured, 2500.0);

            // Set the new game position of the piece
            selected_piece.piece_pos = target_pos;
            captured_piece.piece_pos = null;

            return true;
        }
        else {
            // Oooooops...
            console.warn(`Invalid capture: from '${move_data.from}' to '${move_data.to}' !!!`);
            return false;
        }
    }

    function buryCapturedPiece(capt_piece) {
        // Get the current count for this color
        const grave_count = _graveyard_count[capt_piece.piece_color];

        // Increment graveyard counter for this color
        _graveyard_count[capt_piece.piece_color]++;

        // Get offset x and y for this piece
        const pos_offset_x = grave_count % 4;
        const pos_offset_y = Math.floor(grave_count / 4);

        // Place the captured pieces in their respective graveyard
        const graveyard_3d_pos = gameTo3DPosition(
            capt_piece.piece_color === 'b'
                ? glMatrix.vec2.fromValues(-3.5 - pos_offset_x, -2.0 + pos_offset_y)
                : glMatrix.vec2.fromValues(-3.5 - pos_offset_x, 9.0 - pos_offset_y)
        );

        // Stop the current movement of the piece
        capt_piece.reset_physics_motion();

        const rotation = glMatrix.quat.create();
        glMatrix.quat.fromEuler(rotation, 0.0, Math.PI / 2.0 * (capt_piece.piece_color === 'b' ? -1.0 : 1.0), 0.0);

        function final_position() {
            setTimeout(function () {
                    glMatrix.vec3.sub(graveyard_3d_pos, graveyard_3d_pos, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));
                    capt_piece.anim_to_position(graveyard_3d_pos, 500.0);
                    capt_piece.anim_to_rotation(rotation, 500.0);
                },
                2000.0);
        }

        // Animate piece movement
        capt_piece.anim_move_above_pos(graveyard_3d_pos, 3.0, 1500.0, final_position);
        capt_piece.anim_to_rotation(rotation, 1000.0)
    }

    function setSelectionLight(game_pos) {
        if (game_pos !== null) {
            // Get the 3D position
            const w_pos = gameTo3DPosition(game_pos);
            const square_color = getSquareColor(game_pos);

            lights_set.set_light_position(_selection_spotlight,
                glMatrix.vec3.fromValues(w_pos[0], w_pos[1] + 5.0, w_pos[2])
            );
            lights_set.set_light_color(_selection_spotlight,
                square_color === 'w'
                    ? glMatrix.vec3.fromValues(1.0, 1.0, 1.0)
                    : glMatrix.vec3.fromValues(5.0, 5.0, 5.0)
            );
        }
        else {
            lights_set.set_light_color(_selection_spotlight,
                glMatrix.vec3.fromValues(0.0, 0.0, 0.0)
            );
        }
    }

    function draw(shader) {
        _chessboard.draw(shader);

        for (let i = 0 ; i < _pieces_white.length ; i++) {
            _pieces_white[i].draw(shader);
            _pieces_black[i].draw(shader);
        }
    }

    function draw_move_squares(shader) {
        for (const pm of _possible_moves) {
            _move_squares[pm[0]][pm[1]].draw(shader);
        }
    }

    function on_chess_clicked(picked_object, picked_position) {
        let san_pos;
        let game_pos;

        if (picked_object === _chessboard) {
            game_pos = squareFrom3DPosition(picked_position);
            san_pos = (game_pos === null) ? null : gameToLetterPosition(game_pos);

            if (game_pos !== null) {
                console.log("Chessboard clicked at: " + san_pos);
            }
        }
        else {
            game_pos = picked_object.piece_pos;

            if (game_pos !== null) {
                san_pos = gameToLetterPosition(game_pos);

                console.log(`Piece clicked: ${picked_object.piece_type}, ${picked_object.piece_color} at ${san_pos}`);

                if (picked_object.piece_color === _chess_js_inst.turn()) {
                    // Selection action when a piece is clicked
                    setChessPieceSelection(picked_object);
                }
            }
        }

        processBoardClick(game_pos);
    }

    let prev_hover_object   = null;
    let prev_hover_san_pos  = null;
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
        let san_pos = null;
        let game_pos = null;

        if (picked_object === _chessboard) {
            game_pos = squareFrom3DPosition(picked_position);
            san_pos = (game_pos === null) ? null : gameToLetterPosition(game_pos);

            if (san_pos !== null && (prev_hover_san_pos !== san_pos || prev_hover_object !== picked_object)) {
                console.log("Chessboard hover at: " + san_pos);
            }
        }
        else {
            game_pos = picked_object.piece_pos;
            san_pos = (game_pos === null) ? null : gameToLetterPosition(game_pos);

            if (game_pos !== null) {
                if (prev_hover_object !== picked_object) {
                    console.log(`Piece hover at ${san_pos}: ${picked_object.piece_type}, ${picked_object.piece_color}`);

                    if (picked_object.piece_color === turn_color) {
                        // Highlight the hovered piece
                        picked_object.set_highlighted(true);

                        if (_selected_piece === null) {
                            // Show corresponding move squares
                            determineVisibleMoveSquares(san_pos);
                        }
                    }
                }
            }
        }

        if (prev_hover_san_pos !== san_pos) {
            if (game_pos !== null) {
                // Use a hover color by default, and capture color if square is occupied
                let sq_color = (getPieceAtPosition(game_pos) === null)
                    ? _move_square_color_hover
                    : _move_square_color_capture;

                // Change hovered move square color
                _move_squares[game_pos[0]][game_pos[1]].materials['ms'].set_color(
                    sq_color
                );
                const pos = gameTo3DPosition(game_pos);
                glMatrix.vec3.add(pos, pos, glMatrix.vec3.fromValues(0.0,0.01,0.0));
                _move_squares[game_pos[0]][game_pos[1]].set_position(pos);
            }

            if (prev_hover_san_pos !== null) {
                // Reset color of the previously hovered move square
                _move_squares[prev_game_pos[0]][prev_game_pos[1]].materials['ms'].set_color(
                    _move_square_color_default
                );
                const pos = gameTo3DPosition(prev_game_pos);
                _move_squares[prev_game_pos[0]][prev_game_pos[1]].set_position(pos);
            }
        }

        prev_hover_san_pos = san_pos;
        prev_hover_object = picked_object;
    }


    // Load the texture and bumpmap for the chessboard
    const chessboard_tex = await load_texture(gl, basedir + '/textures/chessboard_tex.png');
    const chessboard_bm  = await load_texture(gl, basedir + '/textures/chessboard_bm.png');

    // Load and create all chess pieces and the chessboard
    const chessboard_mesh = load_obj(basedir + '/objects/chessboard.obj' ,true);
    const _chessboard = await make_object(gl, chessboard_mesh, chessboard_tex, chessboard_bm);
    phys_eng.register_object(_chessboard, 0.0);
    _chessboard.from_chess = true;

    const _pieces_white = [];
    const _pieces_black = [];
    let _selected_piece = null;

    // Number of pieces in the graveyard of each color
    let _graveyard_count = {w: 0, b: 0};

    const _move_squares = new Array(8).fill(null);
    let _possible_moves = [];

    const _chess_js_inst = new Chess();

    const _chess_sound = new Audio(basedir + '/sounds/chess_move.wav');
    _chess_sound.volume = 0.1;
    let _sound_on = true;

    function set_sound_on(sound_on){
        _sound_on = sound_on;
    }

    // Selection spotlight (created off)
    const _selection_spotlight = lights_set.add_spot_light(
        glMatrix.vec3.fromValues(0.0, 0.0, 0.0),    // Position
        glMatrix.vec3.fromValues(0.0, 0.0, 0.0),    // Color
        glMatrix.vec3.fromValues(0.0, -1.0, 0.0),   // Direction
        0,                                          // In Angle
        8                                           // Out Angle
    );

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
        on_chess_hover: on_chess_hover,
        set_sound_on: set_sound_on,
    }
};