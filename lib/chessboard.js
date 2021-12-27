const positions_dict = {
    "A":-6,
    "B":-4.25,
    "C":-2.5,
    "D":-0.8,
    "E":0.8,
    "F":2.5,
    "G":4.25,
    "H":6,

    "1":-6,
    "2":-4.25,
    "3":-2.5,
    "4":-0.8,
    "5":0.8,
    "6":2.5,
    "7":4.25,
    "8":6,
};

const get3DPositionFromBoardPosition = function(board_position) {
    var char_array = board_position.toUpperCase().split('');
    return [positions_dict[char_array[0]], 
            positions_dict[char_array[1]],
            1];
};