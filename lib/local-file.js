
function openFileDialog(callback) {
    // Create a dummy file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.chess-sav';

    input.onchange = e => {
        // Reference to the file
        const file = e.target.files[0];

        // Setting up the reader
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');

        // When a file has been selected
        reader.onload = readerEvent => {
            const content = readerEvent.target.result;
            callback(content);
        }
    }

    input.click();
}

function downloadContent(filename, content) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.click();
}