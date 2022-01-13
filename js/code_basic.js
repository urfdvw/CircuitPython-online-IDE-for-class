/**
 * Ace Related ***************************************************************************
 * https://ace.c9.io/demo/keyboard_shortcuts.html
 */


ace.require("ace/ext/language_tools");
var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/python");
editor.session.setTabSize(4);
editor.session.setUseSoftTabs(true);
editor.session.setUseWrapMode(true);

// auto completion
// https://stackoverflow.com/a/19730470/7037749
editor.setOptions({
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true
});

function toggle_highlight(elem) {
    if(elem.checked){
        editor.session.setMode("ace/mode/python");
    } else {
        editor.session.setMode("ace/mode/text");
    }
}

editor.commands.addCommand({
    name: 'myCommand',
    bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
    exec: function(editor) {
        save_and_run(editor);
    },
});

editor.commands.addCommand({
    name: 'MyOutdent',
    bindKey: { win: 'Ctrl-[', mac: 'Cmd-[' },
    exec: function (editor) {
        console.log('MyOutdent')
        editor.blockOutdent();
    },
    multiSelectAction: "forEach",
    scrollIntoView: "selectionPart"
});

editor.commands.addCommand({
    name: 'MyIntdent',
    bindKey: { win: 'Ctrl-]', mac: 'Cmd-]' },
    exec: function (editor) {
        console.log('MyIntdent')
        editor.blockIndent();
    },
    multiSelectAction: "forEach",
    scrollIntoView: "selectionPart"
});

/**
 * File related functions *********************************************************
 */

let fileHandle;
var butOpenFile = document.getElementById("inputfile")
butOpenFile.addEventListener('click', async () => {
    [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    const contents = await file.text();
    editor.setValue(contents, -1);
    document.getElementById('filename').innerHTML = fileHandle.name;
    document.title = fileHandle.name
    if (fileHandle.name.endsWith('.py') | fileHandle.name.endsWith('.PY')) {
        editor.session.setMode("ace/mode/python");
    } else {
        editor.session.setMode("ace/mode/text");
    }
});

async function writeFile(fileHandle, contents) {
    // Create a FileSystemWritableFileStream to write to.
    const writable = await fileHandle.createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
}

function save_and_run(editor) {
    writeFile(fileHandle, editor.getValue());
}

function download(data, filename, type) {
    // Function to download data to a file
    console.log(data)
    var file = new Blob([data], { type: type });
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

function save_code() {
    try {
        download(editor.getValue(), fileHandle.name, 'text')
    } catch {
        download(editor.getValue(), 'code.py', 'text')
    }
}
