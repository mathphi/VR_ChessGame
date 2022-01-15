const ChessSituation = {
    None:       0,
    Check:      1,
    Checkmate:  2,
    Draw:       4,
    Stalemate:  8,
    Threefold:  16,
    InsufMat:   32,
    GameOver:   64
}

const make_chessboard = async function(gl, camera, phys_eng, lights_set, particle_engine, basedir = '.') {
    const _piece_meshes = {
        p: await load_mesh(basedir + '/objects/pieces/pawn.obj', false),
        b: await load_mesh(basedir + '/objects/pieces/bishop.obj', false),
        r: await load_mesh(basedir + '/objects/pieces/rook.obj', false),
        n: await load_mesh(basedir + '/objects/pieces/knight.obj', false),
        q: await load_mesh(basedir + '/objects/pieces/queen.obj', false),
        k: await load_mesh(basedir + '/objects/pieces/king.obj', false)
    }
    const _piece_cboxes = {
        p: await load_mesh(basedir + '/objects/collision_boxes/c_pawn.obj', false),
        b: await load_mesh(basedir + '/objects/collision_boxes/c_bishop.obj', false),
        r: await load_mesh(basedir + '/objects/collision_boxes/c_rook.obj', false),
        n: await load_mesh(basedir + '/objects/collision_boxes/c_knight.obj', false),
        q: await load_mesh(basedir + '/objects/collision_boxes/c_queen.obj', false),
        k: await load_mesh(basedir + '/objects/collision_boxes/c_king.obj', false)
    }
    const _piece_white_material = make_material(
        'white_piece',
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
        100.0, 1.0,
        0.8
    );
    const _piece_black_material = make_material(
        'black_piece',
        glMatrix.vec3.fromValues(0.0, 0.0, 0.0),
        100.0, 1.0,
        0.3
    );

    // Checkerboard initial case position (relative to chessboard origin)
    const _checkerboard_offset  = glMatrix.vec3.fromValues(5.95, 1.1, -5.95);

    // Space between two squares in the checkerboard
    const _checkerboard_spacing = glMatrix.vec2.fromValues(-1.70, 1.70);

    // This list describes the number of each piece for a player
    const _game_pieces_composition = {
        p: 8, b: 2, r: 2, n: 2, q: 1, k: 1
    }

    // Force impulse applied by a piece on a captured piece
    const _capture_force_factor     = 20.0; // Newton
    const _capture_impulse_duration = 0.1;  // Seconds

    // Mass of the piece
    const _piece_mass = 1.0;

    // Move square colors
    const _move_square_color_default = glMatrix.vec3.fromValues(1.0, 1.0, 0.0);
    const _move_square_color_hover   = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
    const _move_square_color_capture = glMatrix.vec3.fromValues(1.0, 0.5, 0.0);

    // Delay before AI action
    const _ai_action_delay = 1000.0;

    function vec2equals(v1, v2) {
        let diff = false;
        diff |= (v1 === null && v2 !== null);
        diff |= (v1 !== null && v2 === null);
        diff |= (v1 !== null && v2 !== null && !glMatrix.vec2.equals(v1, v2));
        return !diff;
    }

    function force_physics(force) {
        for (let i = 0 ; i < _pieces_white.length ; i++) {
            // Reset all forces/velocities
            if (force === false) {
                _pieces_white[i].reset_physics_motion();
                _pieces_black[i].reset_physics_motion();
            }

            _pieces_white[i].get_physics_body().set_mass(
                (force || _pieces_white[i].piece_pos === null) ? 1.0 : 0.0
            );
            _pieces_black[i].get_physics_body().set_mass(
                (force || _pieces_white[i].piece_pos === null)  ? 1.0 : 0.0
            );
        }

        // Reset all forces/velocities
        if (force === false) {
            _chessboard.reset_physics_motion();
        }

        _chessboard.get_physics_body().set_mass(force ? 10.0 : 0.0);
    }

    function register_on_turn_change_callback(callback) {
        _on_turn_change_callback = callback;
    }

    function register_on_game_event_callback(callback) {
        _on_game_event_callback = callback;
    }

    function get_turn() {
        return _chess_js_inst.turn();
    }

    function enable_ai(enabled, depth = 0) {
        _ai_enabled = enabled;
        _ai_inst.setAnalysisDepth(depth);

        // If this is currently the turn of the black player
        if (get_turn() === 'b' && !_turn_running) {
            processAIMove();
        }
    }

    function anim_to_position(pos, duration, updt_pieces = true) {
        _chessboard.anim_to_position(pos, duration);
        setTimeout(function () {
            if (updt_pieces) updatePieces3DPosition(duration);
            updateMoveSquaresPosition();
        }, duration);
    }

    function anim_to_rotation(quat, duration, updt_pieces = true) {
        _chessboard.anim_to_rotation(quat, duration);
        setTimeout(function () {
            if (updt_pieces) updatePieces3DPosition(duration);
            updateMoveSquaresPosition();
        }, duration);
    }

    function getGameSituation() {
        let situation = ChessSituation.None;
        situation += _chess_js_inst.in_check()      ? ChessSituation.Check      : ChessSituation.None;
        situation += _chess_js_inst.in_checkmate()  ? ChessSituation.Checkmate  : ChessSituation.None;
        situation += _chess_js_inst.in_draw()       ? ChessSituation.Draw       : ChessSituation.None;
        situation += _chess_js_inst.in_stalemate()  ? ChessSituation.Stalemate  : ChessSituation.None;
        situation += _chess_js_inst.in_threefold_repetition()
            ? ChessSituation.Threefold : ChessSituation.None;
        situation += _chess_js_inst.insufficient_material()
            ? ChessSituation.InsufMat : ChessSituation.None;
        situation += _chess_js_inst.game_over()
            ? ChessSituation.GameOver : ChessSituation.None

        return situation;
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

    function makePiece(piece_type, piece_color) {
        const piece = make_object(
            gl,
            _piece_meshes[piece_type],
            null, null,
            piece_color === 'b' ? _piece_black_material : _piece_white_material
        );
        phys_eng.register_object(piece, 0.0, _piece_cboxes[piece_type]);
        piece.piece_type    = piece_type;
        piece.piece_color   = piece_color;
        piece.piece_pos     = null;
        piece.from_chess    = true;
        piece.animated      = false;

        return piece;
    }

    function setupPieces() {
        // List index counter
        let list_idx = 0;

        // Generate the right amount of pieces for each player
        for (const [piece_type, piece_count] of Object.entries(_game_pieces_composition)) {
            for (let i = 0 ; i < piece_count ; i++) {
                let w_transf_prev = null;
                let b_transf_prev = null;

                // If a piece was already created at this index, keep its transform
                if (_pieces_white[list_idx] !== null) {
                    phys_eng.unregister_object(_pieces_white[list_idx]);
                    w_transf_prev = _pieces_white[list_idx].model;
                }
                if (_pieces_black[list_idx] !== null) {
                    phys_eng.unregister_object(_pieces_black[list_idx]);
                    b_transf_prev = _pieces_black[list_idx].model;
                }

                // Make white piece
                _pieces_white[list_idx] = makePiece(piece_type, 'w');
                _pieces_black[list_idx] = makePiece(piece_type, 'b');

                // Restore the previous transform (if one)
                if (w_transf_prev !== null) glMatrix.mat4.copy(_pieces_white[list_idx].model, w_transf_prev);
                if (b_transf_prev !== null) glMatrix.mat4.copy(_pieces_black[list_idx].model, b_transf_prev);

                list_idx++;
            }
        }
    }

    function setChessPiecesPosition() {
        // Reset the position of all pieces (to null)
        for (let i = 0 ; i < _pieces_white.length ; i++) {
            _pieces_white[i].piece_pos = null;
            _pieces_black[i].piece_pos = null;

            _pieces_white[i].get_physics_body().set_mass(0.0);
            _pieces_black[i].get_physics_body().set_mass(0.0);

            _pieces_white[i].animated = false;
            _pieces_black[i].animated = false;
        }

        // Loop over each square and check which piece must be placed on it
        for (let k = 0 ; k < 8 ; k++) {
            for (let l = 0 ; l < 8 ; l++) {
                const game_pos   = glMatrix.vec2.fromValues(k, l);
                const square = _chess_js_inst.get(gameToLetterPosition(game_pos));

                // Skip if no piece must be placed
                if (square === null)
                    continue;

                const piece_list = (square.color === 'w') ? _pieces_white : _pieces_black;

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

        for (const piece of _pieces_white.concat(_pieces_black)) {
            if (piece.piece_pos === null) {
                piece.set_physics_mass(_piece_mass);
                piece.get_physics_body().activate(false);
                buryCapturedPiece(piece).animate();
            }
        }
    }

    function updatePieces3DPosition(anim_duration = 0.0) {
        const piece_rotation_w = _chessboard.get_rotation();
        const piece_rotation_b = _chessboard.get_rotation();
        glMatrix.quat.rotateY(piece_rotation_w, piece_rotation_w, -Math.PI/2.0);
        glMatrix.quat.rotateY(piece_rotation_b, piece_rotation_b, -Math.PI - Math.PI/2.0);

        for (let i = 0 ; i < _pieces_white.length ; i++) {
            if (_pieces_white[i].piece_pos !== null) {
                _pieces_white[i].anim_move_above_pos(gameTo3DPosition(_pieces_white[i].piece_pos), 2.0, anim_duration);
                _pieces_white[i].anim_to_rotation(piece_rotation_w, anim_duration);
            }

            if (_pieces_black[i].piece_pos !== null) {
                _pieces_black[i].anim_move_above_pos(gameTo3DPosition(_pieces_black[i].piece_pos), 2.0, anim_duration);
                _pieces_black[i].anim_to_rotation(piece_rotation_b, anim_duration);
            }
        }
    }

    async function setupMoveSquares() {
        const ms_mesh = await load_mesh(basedir + '/objects/square_plane.obj', false);

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

                _move_squares[k][l] = make_object(gl, ms_mesh, null, null, ms_material);
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
        // If this is the AI's turn
        if ((_ai_enabled && _chess_js_inst.turn() === 'b') || _chess_js_inst.game_over()) {
            // Reset the possible moves list
            _possible_moves = [];
            return;
        }

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
        // Save it for later use
        const current_select_piece = _selected_piece;

        if (current_select_piece !== null) {
            // Move back to initial position
            _selected_piece.anim_to_position(gameTo3DPosition(_selected_piece.piece_pos), 500.0);
            _selected_piece = null;
            
            setSelectionLight(null);
        }

        if (new_select !== null && current_select_piece !== new_select && !_chess_js_inst.game_over()) {
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

    let _waiting_turn = false;
    function processBoardClick(click_pos) {
        // Cancel if no piece is selected or if we are waiting for the previous turn to be done
        if (_selected_piece === null || click_pos === null || _waiting_turn || _chess_js_inst.game_over())
            return;

        // Very dirty hack to wait until the previous turn is done
        if (_turn_running) {
            // Flag to indicate that we are waiting for end of previous turn
            _waiting_turn = true;

            // Recurse and wait an extra-time until the previous turn is done
            setTimeout(function () {
                if (_waiting_turn) {
                    // We are not waiting for the previous turn anymore
                    _waiting_turn = false;
                    processBoardClick(click_pos);
                }
            }, 500.0);
            return;
        }

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

            // Execute the move
            const move_success = checkMoveFlag(move);

            // If something went wrong...
            if (!move_success) {
                // Go back to normal position
                const target_3d_pos = gameTo3DPosition(_selected_piece.piece_pos);
                _selected_piece.anim_to_position(target_3d_pos, 500.0);
            }

            // Hide move squares
            determineVisibleMoveSquares(null);

            // Hide spotlight
            setSelectionLight(null);

            // Unselect the piece
            _selected_piece = null;

            if (move_success) {
                // Turn change callback
                if (typeof (_on_turn_change_callback) === 'function') {
                    _on_turn_change_callback(_chess_js_inst.turn());
                }

                // Game event callback
                if (typeof (_on_game_event_callback) === 'function') {
                    _on_game_event_callback(getGameSituation(), _chess_js_inst.turn() === 'b' ? 'w' : 'b');
                }
            }

            // Run the AI turn if AI is enabled
            if (_ai_enabled) {
                setTimeout(processAIMove, Math.random() * _ai_action_delay);
            }

            return;
        }
    }

    function processAIMove() {
        // Don't play if game is finished
        if (_chess_js_inst.game_over())
            return;

        // Very dirty hack to wait until the previous turn is done
        if (_turn_running) {
            // Recurse and wait an extra-time until the previous turn is done
            setTimeout(processAIMove, 500.0);
            return;
        }

        // The AI can only handle black pieces
        if (_chess_js_inst.turn() !== 'b')
            return;

        // Get the best move from AI algorithm
        const move = _ai_inst.findBestMove(_chess_js_inst);

        // In case of checkmate, there is no best move
        if (move === null) {
            return;
        }

        // Select the piece
        setChessPieceSelection(getPieceAtPosition(letterToGamePosition(move.from)));

        // Apply the move after a certain delay
        setTimeout(function () {
                // Process the move
                checkMoveFlag(move);

                // Hide the move squares
                determineVisibleMoveSquares(null);

                // Hide spotlight
                setSelectionLight(null);

                // Unselect the piece
                _selected_piece = null;

                // Turn change callback
                if (typeof(_on_turn_change_callback) === 'function') {
                    _on_turn_change_callback(_chess_js_inst.turn());
                }

                // Game event callback (check, checkmate,...)
                if (typeof(_on_game_event_callback) === 'function') {
                    _on_game_event_callback(getGameSituation(), _chess_js_inst.turn() === 'b' ? 'w' : 'b');
                }
            },
            (1 + Math.random()) * _ai_action_delay / 2.0
        );
    }

    function checkMoveFlag(move) {
        if (_selected_piece ===  null)
            return;

        console.log(`Processing move:`);
        console.log(move);

        // Set turn running flag
        _turn_running = true;

        // Move success flag
        let move_success = false;

        // If this is a possible move, check if it is a simple move, a capture, a promotion,...
        if (move.flags.includes('n') || move.flags.includes('b')) {
            // Non-capture or Pawn push of two squares
            move_success = processPieceMove(move, turn_done);
        }
        else if (move.flags.includes('c')) {
            // Standard capture
            move_success = processPieceCapture(move, turn_done);
        }
        else if (move.flags.includes('e')) {
            // En passant
            move_success = processPieceEnPassant(move, turn_done);
        }
        else if (move.flags.includes('k')) {
            // Kingside castling
            move_success = processPieceCastling(move, turn_done);
        }
        else if (move.flags.includes('q')) {
            // Queenside castling
            move_success = processPieceCastling(move, turn_done);
        }
        else {
            // Ooops...
            console.warn(`Unable to process the move (unknown flags: ${move.flags})`);
        }

        function turn_done() {
            _turn_running = false;
        }

        return move_success;
    }

    function processPieceMove(move_data, callback = null) {
        // Convert positions
        const from_pos_san = gameToLetterPosition(_selected_piece.piece_pos);
        const target_pos = letterToGamePosition(move_data.to);
        const selected_piece = _selected_piece;

        // Move infos (basic)
        const move_infos = {from: move_data.from, to: move_data.to};

        // If this is a promotion
        if (move_data.flags.includes('p')) {
            // Let promote the pawn to a queen by default
            move_infos.promotion = 'q';
        }

        // Process the move in game logic
        const move_result = _chess_js_inst.move(move_infos);

        if (move_result !== null) {
            // Mark this piece as animated
            selected_piece.animated = true;

            // If all was done correctly, the move is valid, and we can animate
            const target_3d_pos = gameTo3DPosition(target_pos);
            selected_piece.anim_move_above_pos(target_3d_pos, 2.0, 750.0, move_done);

            if(_sound_on) {setTimeout(function(){_chess_move_sound.play();}, 600);}

            // Set the new game position of the piece
            selected_piece.piece_pos = target_pos;

            return true;
        }
        else {
            // Oooooops...
            console.warn(`Invalid move: from '${from_pos_san}' to '${move_data.to}' !!!`);
            return false;
        }

        function move_done() {
            // Don't continue if this animation has been forced to stop
            if (!selected_piece.animated)
                return;

            // If a promotion is needed after this move
            if (move_data.flags.includes('p')) {
                // Promotion (we promote to a queen by default)
                processPiecePromotion(selected_piece, callback);
            }
            else {
                if (typeof(callback) === "function") callback();
            }
        }
    }

    function processPieceCapture(move_data, callback = null) {
        const from_pos = letterToGamePosition(move_data.from);
        const target_pos = letterToGamePosition(move_data.to);

        // Retrieve captured piece to act on it
        const selected_piece = _selected_piece;
        const captured_piece = getPieceAtPosition(target_pos);

        if (captured_piece === null) {
            console.warn("Unable to find captured piece object")
            return false;
        }

        // Move infos (basic)
        const move_infos = {from: move_data.from, to: move_data.to};

        // If this is a promotion
        if (move_data.flags.includes('p')) {
            // Let promote the pawn to a queen by default
            move_infos.promotion = 'q';
        }

        // Process the move in game logic
        const move_result = _chess_js_inst.move(move_infos);

        if (move_result !== null) {
            // If all was done correctly, the move is valid, and we can animate
            
            // Mark pieces as animated
            selected_piece.animated = true;
            captured_piece.animated = true;

            // This piece has been captured
            captured_piece.captured = true;

            // Prepare captured piece for burying
            const burying = buryCapturedPiece(captured_piece);

            // Callback functions
            function final_anim() {
                // Don't continue if this animation has been forced to stop
                if (!selected_piece.animated)
                    return;

                selected_piece.anim_to_position(end_3d_pos, 500.0, move_done);
            }
            function destructor_force() {
                // Don't continue if this animation has been forced to stop
                if (!captured_piece.animated)
                    return;

                /*
                 * NOTE: Here we can't use the btRigidBody::applyForce() method, because this will apply
                 * a force during one simulation tick. Since the simulation tick depends on FPS, the movement
                 * resulting from the force would depend on the FPS too, which is not acceptable...
                 */
                // Add a random component to the force factor (more natural)
                const force_factor = _capture_force_factor * 1.5 * (1 + Math.random());
                // This force factor will vary between 100% and 150% of the original force factor

                // Force parameters
                const force_pos = glMatrix.vec3.fromValues(0.0, 1.5, 0.0);
                const force = glMatrix.vec3.create();
                glMatrix.vec3.scale(force, delta_pos_n, force_factor);

                // Apply the force impulse
                captured_piece.get_physics_body().apply_force_impulse(force, force_pos, _capture_impulse_duration);
                if(_sound_on) {_chess_capture_sound.play();}
            }
            function handle_captured() {
                // Don't continue if this animation has been forced to stop
                if (!captured_piece.animated)
                    return;

                burying.animate();
            }
            function move_done() {
                if(_sound_on) {_chess_move_sound.play();}
                // Don't continue if this animation has been forced to stop
                if (!selected_piece.animated)
                    return;

                // If a promotion is needed after this move
                if (move_data.flags.includes('p')) {
                    // Promotion (we promote to a queen by default)
                    processPiecePromotion(selected_piece, callback);
                }
                else {
                    if (typeof(callback) === "function") callback();
                }
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

    function buryCapturedPiece(capt_piece, callback = null) {
        // Get the current count for this color
        const grave_count = _graveyard_list[capt_piece.piece_color].length;

        // Increment graveyard counter for this color
        _graveyard_list[capt_piece.piece_color].push(capt_piece);

        // Get offset x and y for this piece
        const pos_offset_x = grave_count % 4;
        const pos_offset_y = Math.floor(grave_count / 4);

        // Place the captured pieces in their respective graveyard
        const graveyard_3d_pos = gameTo3DPosition(
            capt_piece.piece_color === 'b'
                ? glMatrix.vec2.fromValues(-3.5 - pos_offset_x, -2.0 + pos_offset_y)
                : glMatrix.vec2.fromValues(-3.5 - pos_offset_x, 9.0 - pos_offset_y)
        );

        // Mark piece as animated
        capt_piece.animated = true;

        function animate() {
            // Stop the current movement of the piece
            capt_piece.reset_physics_motion();

            const rotation = glMatrix.quat.create();
            glMatrix.quat.fromEuler(rotation, 0.0, Math.PI / 2.0 * (capt_piece.piece_color === 'b' ? -1.0 : 1.0), 0.0);

            function final_position() {
                setTimeout(function () {
                        // Don't continue if this animation has been forced to stop
                        if (!capt_piece.animated)
                            return;

                        glMatrix.vec3.sub(graveyard_3d_pos, graveyard_3d_pos, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));
                        capt_piece.anim_to_position(graveyard_3d_pos, 500.0, callback);
                        capt_piece.anim_to_rotation(rotation, 500.0);
                    },
                    2000.0);
            }

            // Current piece position
            const init_pos = capt_piece.get_position();

            // Up offset for intermediate positions
            const up_offset = 5.0;

            // Compute intermediate positions for the movement Bézier curve
            const inter_pos1 = glMatrix.vec3.fromValues(
                init_pos[0],
                Math.max(init_pos[1] + up_offset, graveyard_3d_pos[1] + up_offset),
                init_pos[2]
            );
            const inter_pos2 = glMatrix.vec3.fromValues(
                graveyard_3d_pos[0],
                graveyard_3d_pos[1] + up_offset,
                graveyard_3d_pos[2]
            );

            // Animate piece movement
            capt_piece.anim_move_bezier_curve(init_pos, inter_pos1, inter_pos2, graveyard_3d_pos, 2000.0, final_position);
            capt_piece.anim_to_rotation(rotation, 1000.0);
        }

        return {
            animate: animate
        }
    }

    function processPieceEnPassant(move_data, callback = null) {
        const from_pos  = letterToGamePosition(move_data.from);
        const to_pos    = letterToGamePosition(move_data.to);

        // We must determine the position of the captured piece using .from and .to
        const capt_pos = glMatrix.vec2.fromValues(to_pos[0], from_pos[1]);

        // Retrieve captured piece to act on it
        const selected_piece = _selected_piece;
        const captured_piece = getPieceAtPosition(capt_pos);

        if (captured_piece === null) {
            console.warn("Unable to find captured piece object")
            return false;
        }

        // Process the move in game logic
        const move_result = _chess_js_inst.move({from: move_data.from, to: move_data.to});

        if (move_result !== null) {
            // If all was done correctly, the move is valid, and we can animate

            // Mark pieces as animated
            selected_piece.animated = true;
            captured_piece.animated = true;

            // This piece has been captured
            captured_piece.captured = true;

            // Apply physics on the target piece
            captured_piece.set_physics_mass(_piece_mass);
            captured_piece.get_physics_body().activate(false);
            selected_piece.get_physics_body().activate(false);

            // Prepare captured piece for burying
            const burying = buryCapturedPiece(captured_piece);

            // Get start, end and captured world positions
            //const start_3d_pos = gameTo3DPosition(from_pos);
            const end_3d_pos   = gameTo3DPosition(to_pos);
            const capt_3d_pos  = gameTo3DPosition(capt_pos);

            // Determine the movement curve
            const init_pos_3d   = selected_piece.get_position();
            const target_pos_3d = glMatrix.vec3.create();

            const inter_pos1 = glMatrix.vec3.fromValues(
                capt_3d_pos[0],
                capt_3d_pos[1] + 1.5,
                capt_3d_pos[2]
            );
            const inter_pos2 = glMatrix.vec3.fromValues(
                capt_3d_pos[0],
                capt_3d_pos[1] + 1.5,
                capt_3d_pos[2]
            );

            // End position is above the square, and final_anim will place the piece on its final position
            glMatrix.vec3.add(target_pos_3d, end_3d_pos, glMatrix.vec3.fromValues(0.0, 2.0, 0.0));

            // Start movement and animation
            const duration = 500.0;
            selected_piece.anim_move_bezier_curve(
                init_pos_3d,
                inter_pos1,
                inter_pos2,
                target_pos_3d,
                duration,
                final_anim
            );

            setTimeout(destructor_force, duration / 3.0);
            setTimeout(handle_captured, 2500.0);

            // Set the new game position of the piece
            selected_piece.piece_pos = to_pos;
            captured_piece.piece_pos = null;

            // Callback functions
            function final_anim() {
                // Don't continue if this animation has been forced to stop
                if (!selected_piece.animated)
                    return;

                selected_piece.anim_to_position(end_3d_pos, 500.0, callback);
            }
            function destructor_force() {
                // Don't continue if this animation has been forced to stop
                if (!captured_piece.animated)
                    return;

                // Add a random component to the force factor (more natural)
                const force_factor = _capture_force_factor * 1.5 * (1 + Math.random());
                // This force factor will vary between 100% and 150% of the original force factor

                // Force parameters
                const force_pos = glMatrix.vec3.fromValues(0.0, 1.5, 0.0);

                // We must compute the force vector using the 3 positions
                const force = glMatrix.vec3.create();
                const tmp_vect = glMatrix.vec3.create();

                // Delta_1 = Capt_pos - init_pos
                glMatrix.vec3.sub(force, capt_3d_pos, init_pos_3d);
                // Delta_2 = Capt_pos - target_pos
                glMatrix.vec3.sub(tmp_vect, capt_3d_pos, target_pos_3d);
                // Force = Delta_1 + Delta_2
                glMatrix.vec3.add(force, force, tmp_vect);
                // Normalize
                glMatrix.vec3.normalize(force, force);
                // Scale to actual force value
                glMatrix.vec3.scale(force, force, force_factor);

                // Apply the force impulse
                captured_piece.get_physics_body().apply_force_impulse(force, force_pos, _capture_impulse_duration);
                if(_sound_on) {_chess_capture_sound.play();setTimeout(function(){_chess_move_sound.play();}, 700);}
            }
            function handle_captured() {
                // Don't continue if this animation has been forced to stop
                if (!captured_piece.animated)
                    return;

                burying.animate();
            }

            return true;
        }
        else {
            // Oooooops...
            console.warn(`Invalid en passant: from '${move_data.from}' to '${move_data.to}' !!!`);
            return false;
        }
    }

    function processPieceCastling(move_data, callback = null) {
        const from_pos  = letterToGamePosition(move_data.from);
        const to_pos    = letterToGamePosition(move_data.to);

        // We must determine the position of the rook 'k' or 'q' flag
        // Rook is at x+1 at kingside (k) and x-1 at queenside (q)
        const rook_pos_init = glMatrix.vec2.fromValues(
            to_pos[0] + (move_data.flags.includes('k') ? 1.0 : -2.0),
            to_pos[1]
        );
        const rook_pos_end = glMatrix.vec2.fromValues(
            to_pos[0] + (move_data.flags.includes('k') ? -1.0 : 1.0),
            to_pos[1]
        );

        // Retrieve pieces to act on them
        const selected_piece = _selected_piece;
        const rook_piece = getPieceAtPosition(rook_pos_init);

        if (rook_piece === null) {
            console.warn("Unable to find rook for castling...")
            return false;
        }

        // Process the move in game logic
        const move_result = _chess_js_inst.move({from: move_data.from, to: move_data.to});

        if (move_result !== null) {
            // If all was done correctly, the move is valid, and we can animate

            // Mark pieces as animated
            selected_piece.animated = true;
            rook_piece.animated = true;

            if(_sound_on) {_chess_slide_sound.play();setTimeout(function(){_chess_move_sound.play();}, 700);}

            // Animate the King
            const target_3d_pos = gameTo3DPosition(to_pos);
            selected_piece.anim_move_above_pos(target_3d_pos, 3.0, 750.0, callback);

            // Animate the rook
            const rook_target_3d_pos = gameTo3DPosition(rook_pos_end);
            rook_piece.anim_to_position(rook_target_3d_pos, 500.0);

            // Set the new game position of the piece
            selected_piece.piece_pos = to_pos;
            rook_piece.piece_pos = rook_pos_end;

            return true;
        }
        else {
            // Oooooops...
            console.warn(`Invalid castling: from '${move_data.from}' to '${move_data.to}' !!!`);
            return false;
        }
    }

    function processPiecePromotion(piece_object, callback = null) {
        // We will transform a pawn to a queen in this case
        const init_pos = gameTo3DPosition(piece_object.piece_pos);

        // Send the piece UP (far, far away)
        const far_pos = glMatrix.vec3.create();
        glMatrix.vec3.add(far_pos, init_pos, glMatrix.vec3.fromValues(0.0, 25.0, 0.0));

        // Anim the movement (disappearing) and promote at the end
        piece_object.anim_to_position(far_pos, 500.0, promote);

        // Prepare the new piece
        const new_piece = makePiece('q', piece_object.piece_color);
        
        function promote() {
            if (!piece_object.animated)
                return;

            // Place the piece at right position (game pos and 3D pos)
            new_piece.piece_pos = piece_object.piece_pos;
            new_piece.set_position(piece_object.get_position());
            new_piece.set_rotation_quat(piece_object.get_rotation());
            new_piece.set_scaling(piece_object.get_scaling());

            // Replace the object in the pieces list
            const pieces_list = piece_object.piece_color === 'w' ? _pieces_white : _pieces_black;
            const piece_idx = pieces_list.indexOf(piece_object);
            pieces_list[piece_idx] = new_piece;

            // Remove the previous object from physics
            phys_eng.unregister_object(piece_object);

            // Move back to chessboard
            if(_sound_on) {setTimeout(function(){_chess_promotion_sound.play();}, 000);}
            new_piece.anim_to_position(init_pos, 500.0, callback);
            setTimeout(stars_effect, 500.0); // Show dust effect when piece hits the chessboard
        }
        function stars_effect() {
            if (particle_engine === null)
                return;

            // Parametrize a dust effect using a particle jet
            const dust = make_particle_jet(
                gl, camera,
                ParticleType.Star,
                init_pos, 0.7, glMatrix.vec3.fromValues(0.0, 1.0, 0.0),
                2.0,
                2000, 0.05,
                glMatrix.vec3.fromValues(0.8, 0.7, 0.2), 0.3,
                1.5, glMatrix.vec3.fromValues(0.0, -0.2, 0.0),
                0.5
            );

            // Register the particle system
            particle_engine.register_particle_system(dust);
        }
    }

    function processUndoMove() {
        const undone_move = _chess_js_inst.undo();

        // Abort if there is no undo available
        if (undone_move === null) {
            return;
        }

        const turn_color  = undone_move.color;
        const move_target = letterToGamePosition(undone_move.to);
        const move_origin = letterToGamePosition(undone_move.from);

        const undone_piece = getPieceAtPosition(move_target);

        // Place piece to its original position
        undone_piece.piece_pos = move_origin;
        undone_piece.animated  = false;

        // Undo capture
        if (undone_move.flags.includes('c')) {
            const grvyrd_list = _graveyard_list[turn_color === 'w' ? 'b' : 'w'];

            // Get last piece from graveyard and remove from it
            const capt_piece = grvyrd_list[grvyrd_list.length-1];
            grvyrd_list.splice(grvyrd_list.length-1, 1);

            // Reset its original position
            capt_piece.piece_pos = move_target;
            capt_piece.animated  = false;
            capt_piece.get_physics_body().set_mass(0.0);
        }
        // Undo en passant
        else if (undone_move.flags.includes('e')) {
            const grvyrd_list = _graveyard_list[turn_color === 'w' ? 'b' : 'w'];

            // Get last piece from graveyard and remove from it
            const capt_piece = grvyrd_list[grvyrd_list.length-1];
            grvyrd_list.splice(grvyrd_list.length-1, 1);

            // Determine the original captured piece position and reset its original position
            capt_piece.piece_pos = glMatrix.vec2.fromValues(move_target[0], move_origin[1]);
            capt_piece.animated  = false;
            capt_piece.get_physics_body().set_mass(0.0);
        }
        // Undo castling
        else if (undone_move.flags.includes('q') || undone_move.flags.includes('k')) {
            const rook_pos_init = glMatrix.vec2.fromValues(
                move_target[0] + (undone_move.flags.includes('k') ? 1.0 : -2.0),
                move_target[1]
            );
            const rook_pos_end = glMatrix.vec2.fromValues(
                move_target[0] + (undone_move.flags.includes('k') ? -1.0 : 1.0),
                move_target[1]
            );

            // Reset the rook position
            const rook_piece = getPieceAtPosition(rook_pos_end);
            rook_piece.piece_pos = rook_pos_init;
            rook_piece.animated  = false;
        }

        // Undo promotion
        if (undone_move.flags.includes('p')) {
            // Regenerate a simple pawn

            // Prepare the new piece
            const new_piece = makePiece('p', undone_piece.piece_color);

            // Place the piece at right position (game pos and 3D pos)
            new_piece.piece_pos = undone_piece.piece_pos;
            new_piece.set_position(undone_piece.get_position());
            new_piece.set_rotation_quat(undone_piece.get_rotation());
            new_piece.set_scaling(undone_piece.get_scaling());

            // Replace the object in the pieces list
            const pieces_list = undone_piece.piece_color === 'w' ? _pieces_white : _pieces_black;
            const piece_idx = pieces_list.indexOf(undone_piece);
            pieces_list[piece_idx] = new_piece;

            // Remove the previous object from physics
            phys_eng.unregister_object(undone_piece);
        }
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

                if (picked_object.piece_color === _chess_js_inst.turn() &&
                    !(_ai_enabled && _chess_js_inst.turn() === 'b') &&
                    !_turn_running)
                {
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
                        // Highlight except if this is AI's turn
                        if (!(_ai_enabled && _chess_js_inst.turn() === 'b')) {
                            // Highlight the hovered piece
                            picked_object.set_highlighted(true);
                        }

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

    function reset_game() {
        // Reset the game logic
        _chess_js_inst.reset();

        // setup pieces
        setupPieces();

        // Place the pieces at the right position
        setChessPiecesPosition();
        updatePieces3DPosition(1000.0);

        // Reset status variables and flags
        _selected_piece = null;
        _turn_running = false;
        _graveyard_list = {w: [], b: []};
        _possible_moves = [];

        // Send turn change and game events
        if (typeof(_on_game_event_callback) === "function") {
            _on_game_event_callback(getGameSituation(), _chess_js_inst.turn() === 'b' ? 'w' : 'b');
        }
        if (typeof(_on_turn_change_callback) === "function") {
            _on_turn_change_callback(_chess_js_inst.turn());
        }
    }

    function undo_game() {
        const current_turn = get_turn();

        processUndoMove();

        // Undo twice if AI enabled and not its turn
        if (_ai_enabled && current_turn === 'w') {
            processUndoMove();
        }

        // Unselect
        setChessPieceSelection(null);
        determineVisibleMoveSquares(null);

        // Flags
        _turn_running = false;
        _waiting_turn = false;

        // Place the pieces back to their position
        updatePieces3DPosition(1000.0);
    }

    function get_board_str() {
        return _chess_js_inst.fen();
    }

    function load_board_str(fen_str) {
        const fen_valid = _chess_js_inst.load(fen_str);

        // Ensure the FEN string is valid
        if (!fen_valid)
            return false;


        // Unselect
        setChessPieceSelection(null);
        determineVisibleMoveSquares(null);

        // Reset status variables and flags
        _selected_piece = null;
        _turn_running = false;
        _graveyard_list = {w: [], b: []};
        _possible_moves = [];

        // Place the pieces back to their position
        setChessPiecesPosition();
        updatePieces3DPosition(1000.0);

        // If it is AI's turn
        if (_ai_enabled && _chess_js_inst.turn() === 'b') {
            processAIMove();
        }

        // Send turn change and game events
        if (typeof(_on_game_event_callback) === "function") {
            _on_game_event_callback(getGameSituation(), _chess_js_inst.turn() === 'b' ? 'w' : 'b');
        }
        if (typeof(_on_turn_change_callback) === "function") {
            _on_turn_change_callback(_chess_js_inst.turn());
        }

        return true;
    }

    function playEndgameSound(game_state){
        if(_sound_on) {
            switch(game_state) {
                case "lose":
                    _chess_lose_sound.play();
                    break;
                case "win":
                case "draw":
                default:
                    _chess_win_sound.play();
                    break;
            }
        }
    }


    // Load the texture and bumpmap for the chessboard
    const chessboard_tex = await load_texture(gl, basedir + '/textures/chessboard_tex.png');
    const chessboard_bm  = await load_texture(gl, basedir + '/textures/chessboard_bm.jpg');

    // Load and create all chess pieces and the chessboard
    const chessboard_mesh = await load_mesh(basedir + '/objects/chessboard.obj' ,true);
    const _chessboard = make_object(gl, chessboard_mesh, chessboard_tex, chessboard_bm);
    phys_eng.register_object(_chessboard, 0.0);
    _chessboard.from_chess = true;

    const _pieces_white = new Array(16).fill(null);
    const _pieces_black = new Array(16).fill(null);
    let _selected_piece = null;
    let _turn_running = false;  // Flag to indicate if a turn is running (pieces are currently moving)

    // Number of pieces in the graveyard of each color
    let _graveyard_list = {w: [], b: []};

    const _move_squares = new Array(8).fill(null);
    let _possible_moves = [];

    const _chess_js_inst = new Chess();

    // AI
    const _ai_inst = makeAI(0, _chess_js_inst);
    let _ai_enabled = false;

    function is_ai_enabled() {
        return _ai_enabled;
    }

    // Sound
    const _chess_move_sound = new Audio(basedir + '/sounds/chess_move.mp3');
    const _chess_capture_sound = new Audio(basedir + '/sounds/chess_capture.mp3');
    const _chess_slide_sound = new Audio(basedir + '/sounds/chess_slide.mp3');
    const _chess_promotion_sound = new Audio(basedir + '/sounds/chess_promotion.mp3');
    const _chess_win_sound = new Audio(basedir + '/sounds/chess_win.mp3');
    const _chess_lose_sound = new Audio(basedir + '/sounds/chess_lose.mp3');
    _chess_move_sound.volume        = 0.5;
    _chess_capture_sound.volume     = 0.5;
    _chess_slide_sound.volume       = 0.5;
    _chess_promotion_sound.volume   = 0.5;
    _chess_win_sound.volume         = 0.5;
    _chess_lose_sound.volume        = 0.5;

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

    // Callbacks
    let _on_turn_change_callback = null;
    let _on_game_event_callback  = null;

    setupPieces();
    setChessPiecesPosition();
    updatePieces3DPosition();

    await setupMoveSquares();
    updateMoveSquaresPosition();

    return {
        draw: draw,
        draw_move_squares: draw_move_squares,
        anim_to_position: anim_to_position,
        anim_to_rotation: anim_to_rotation,
        get_position: _chessboard.get_position,
        squareFrom3DPosition: squareFrom3DPosition,
        gameToLetterPosition: gameToLetterPosition,
        gameTo3DPosition: gameTo3DPosition,
        on_chess_clicked: on_chess_clicked,
        on_chess_hover: on_chess_hover,
        set_sound_on: set_sound_on,
        register_on_game_event_callback: register_on_game_event_callback,
        register_on_turn_change_callback: register_on_turn_change_callback,
        get_turn: get_turn,
        enable_ai: enable_ai,
        is_ai_enabled: is_ai_enabled,
        force_phycics: force_physics,
        reset_game: reset_game,
        undo_game: undo_game,
        get_board_str: get_board_str,
        load_board_str: load_board_str,
        playEndgameSound: playEndgameSound,
    }
};