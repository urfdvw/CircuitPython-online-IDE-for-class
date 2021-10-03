/**
 * info ****************************************************************
 */

document.title = 'CPy IDE'

/**
 * Serial driver *******************************************************
 */

let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

async function connect() {
    // connect to serial

    // - Request a port and open a connection.
    port = await navigator.serial.requestPort();

    // - Wait for the port to open.
    await port.open({ baudRate: 115200 });

    // if connected, change the button name
    document.getElementById("connect").innerHTML = "connected"

    // setup the output stream.
    const encoder = new TextEncoderStream();
    outputDone = encoder.readable.pipeTo(port.writable);
    outputStream = encoder.writable;

    // read the stream.
    let decoder = new TextDecoderStream();
    inputDone = port.readable.pipeTo(decoder.writable);
    inputStream = decoder.readable;

    reader = inputStream.getReader();
    readLoop();
}

async function disconnect() {
    // not used actually

    // Close the input stream (reader).
    if (reader) {
        await reader.cancel();
        await inputDone.catch(() => { });
        reader = null;
        inputDone = null;
    }

    // Close the output stream.
    if (outputStream) {
        await outputStream.getWriter().close();
        await outputDone;
        outputStream = null;
        outputDone = null;
    }

    // Close the port.
    await port.close();
    port = null;
}

async function clickConnect() {
    // if connected, ignore the button action
    if (port) {
        return;
    }

    // CODELAB: Add connect code here.
    await connect();
}

var serial_value_text = "";
async function readLoop() {
    // Reads data from the input stream and displays it in the console.
    while (true) {
        const { value, done } = await reader.read();
        if (value) {
            serial_value_text += value;
            serial.setValue(serial_value_text);
            get_dir_returns();
            // removed the carriage return, for some reason CircuitPython does not need it
            //log.innerHTML += value + '\n';
        }
        if (done) {
            console.log('[readLoop] DONE', done);
            reader.releaseLock();
            break;
        }
    }
}

// auto scroll 
new ResizeObserver(function () {
    out_frame.parentNode.scrollTop = out_frame.parentNode.scrollHeight;
}).observe(out_frame)

/**
 * command related functions ****************************************************
 */

function send_cmd(s) {
    // send single byte command
    // s: str
    const writer = outputStream.getWriter();
    writer.write(s);
    writer.releaseLock();
}

function sendCTRLD() {
    send_cmd("\x04");
}

function sendCTRLC() {
    send_cmd("\x03");
}

var cmd_hist = ['print("Hello CircuitPython!")']; // command history
var cmd_ind = -1; // command history index

function push_to_cmd_hist(str) {
    if (str.trim().length != 0) {
        cmd_hist.push(str.trim());
    }
}

function send_multiple_lines(lines) {
    // send multiple lines of code to device
    // lines: str (str can contain line breaks)

    // push to history
    push_to_cmd_hist(lines);
    cmd_ind = -1;

    // dealing with linebreaks and '\n' in text
    lines = lines.split('\\').join('\\\\').split('\n').join('\\n')

    // remove comments by """
    lines = lines.split('"""')
    for (var i = 0; i < lines.length; i++) {
        lines.splice(i + 1, 1);
    }
    lines = lines.join("")

    // send commands to device
    if (outputStream != null) {
        const writer = outputStream.getWriter();
        // https://stackoverflow.com/a/60111488/7037749
        writer.write('exec("""' + lines + '""")' + '\x0D')
        writer.releaseLock();
    }
    else {
        console.log("Can not write, no connection.");
    }
}

function send_single_line(line) {
    // send one line of code to device

    // if command not empty, push the command to history
    push_to_cmd_hist(line);
    cmd_ind = -1;

    // send the command to device
    if (outputStream != null) {
        const writer = outputStream.getWriter();
        writer.write(line.trim() + '\x0D');
        writer.releaseLock();
    }
    else {
        console.log("Can not write, no connection.");
    }
}

/**
 * File related functions *********************************************************
 */

let fileHandle;
var butOpenFile = document.getElementById("inputfile")
butOpenFile.addEventListener('click', async () => {
    [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    const contents = await file.text();
    editor.setValue(contents);
    document.getElementById('filename').innerHTML = fileHandle.name;
    document.title = fileHandle.name
});

async function writeFile(fileHandle, contents) {
    // Create a FileSystemWritableFileStream to write to.
    const writable = await fileHandle.createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
}

function save_and_run(cm) {
    writeFile(fileHandle, cm.getValue());
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
        download(editor.getValue(), 'main.py', 'text')
    }
}

function savelog() {
    // only works out side html
    download(
        serial.getValue(),
        'log.txt',
        'text'
    )
}

/**
 * Code mirrow Related ***************************************************************************
 */

var editor_info = '"""\n' +
    'Please connect the board before any operation.\n\n' +
    '--- Editor Keyboard Shortcuts ---\n\n' +
    '[Ctrl-S]: Save the file\n    This will trigger reset and run in File mode\n' +
    '[Ctrl-Space]: auto completion\n\n' +
    'REPL Mode Specific:\n' +
    '[Shift-Enter] to run current line of code\n    or selected multiple lines of code.\n' +
    '[Ctrl-Enter] to clear existing variable(s) and run current file.\n' +
    '    This is best after restart REPL and [Ctrl-S]\n' +
    '"""\nimport board\n'

CodeMirror.commands.autocomplete = function (cm) {
    cm.showHint({ hint: CodeMirror.hint.any });
    cm.showHint({ hint: CodeMirror.hint.anyword });
}

var editor = CodeMirror(document.querySelector('#my-div'), {
    lineNumbers: true,
    value: editor_info,
    tabSize: 4,
    indentUnit: 4,
    mode: 'python',
    theme: 'monokai',
    extraKeys: {
        Tab: betterTab,
        "Ctrl-Space": "autocomplete"
    },
    lineWrapping: true,
});
editor.setSize(width = '100%', height = '100%')

var serial_info = "\
Serial console help\n\n\
Serial outputs are going to show below.\n\
The white textarea is for serial inputs.\n\n\
Keyboard shortcuts:\n\
[Enter] send command(s)\n\
[Shift-Enter] newline\n\
[Up] and [Down] recall history commands\n\
[Ctrl-Shift-C] send 'Ctrl-C' signal\n\
[Ctrl-D] send 'Ctrl-D' signal\n\n\
The shortcut of send and newline can be\n\
swapped by the button at the bottom.\n\
*******************************************\n\
"

var serial = CodeMirror(document.querySelector('#serial_R'), {
    lineNumbers: false,
    value: serial_info,
    theme: 'monokai',
    mode: 'text',
    readOnly: true,
    lineWrapping: true,
});
serial.setSize(width = '100%', height = '100%')

var command = CodeMirror(document.querySelector('#serial_T'), {
    lineNumbers: false,
    value: 'help()',
    tabSize: 4,
    indentUnit: 4,
    mode: 'python',
    extraKeys: { Tab: betterTab },
    lineWrapping: true,
});
command.setSize(width = '100%', height = '100%')

// https://stackoverflow.com/a/25104834/7037749
editor.addKeyMap({
    "Shift-Enter": run_current,
    "Ctrl-Enter": run_all_lines,
    "Ctrl-S": save_and_run,
    "Ctrl-/": 'toggleComment',
});

command.addKeyMap({
    "Shift-Enter": "newlineAndIndent",
    "Enter": run_command,
    "Up": hist_up,
    "Down": hist_down,
    "Shift-Ctrl-C": sendCTRLC,
    "Ctrl-D": sendCTRLD,
});

var enter_to_send = true;
function change_send_key() {
    if (enter_to_send) {
        command.addKeyMap({
            "Enter": "newlineAndIndent",
            "Shift-Enter": run_command,
        });
        document.getElementById('send_setting').innerHTML = "[Shift-Enter] to send";
        enter_to_send = false;
    } else {
        command.addKeyMap({
            "Shift-Enter": "newlineAndIndent",
            "Enter": run_command,
        });
        document.getElementById('send_setting').innerHTML = "[Enter] to send";
        enter_to_send = true;
    }
}

function betterTab(cm) {
    // https://github.com/codemirror/CodeMirror/issues/988#issuecomment-14921785
    if (cm.somethingSelected()) {
        cm.indentSelection("add");
    } else {
        cm.replaceSelection(cm.getOption("indentWithTabs") ? "\t" :
            Array(cm.getOption("tabSize") + 1).join(" "), "end", "+input");
    }
}

function run_current(cm) {
    var selected = cm.getSelection()
    if (selected) { // if any sellection
        send_multiple_lines(selected)
    } else {
        send_single_line(cm.getLine(cm.getCursor()["line"]))
        if (cm.lineCount() == cm.getCursor()["line"] + 1) { // if last line
            cm.execCommand('newlineAndIndent');
            cm.execCommand('indentLess');
        } else {
            cm.setCursor({
                line: cm.getCursor()["line"] + 1,
                ch: cm.getLine(cm.getCursor()["line"] + 1).length
            })
        }
    }
}

function run_all_lines() {
    cmd = "import gc\n" +
        "gc.enable()\n" +
        "import sys\nsys.modules.clear()\n" +
        "while globals():\n" +
        "    del globals()[list(globals().keys())[0]]\n" +
        "__name__ = '__main__'\n" +
        "import gc\n" +
        "gc.enable()\n" +
        "gc.collect()\n" +
        "from " +
        fileHandle.name.split('.')[0] + " import *"
    send_multiple_lines(cmd)
    cmd_hist.pop();
}

function run_command(cm) {
    if (cm.lineCount() == 1) {
        var line = cm.getLine(cm.getCursor()["line"]);
        send_single_line(line);
    } else {
        var lines = cm.getValue();
        send_multiple_lines(lines);
    }

    cm.setValue("")
}

var temp_cmd = '';
function hist_up(cm) {
    if (cm.getCursor()["line"] == 0) {
        if (cmd_ind == -1) {
            cmd_ind = cmd_hist.length - 1
            temp_cmd = cm.getValue();
        } else {
            cmd_ind -= 1;
        }
        if (cmd_ind < 0) {
            cmd_ind = 0
        }
        cm.setValue(cmd_hist[cmd_ind])
    } else {
        cm.setCursor({ "line": cm.getCursor()["line"] - 1, "ch": cm.getCursor()["ch"] })
    }
}

function hist_down(cm) {
    if (cm.getCursor()["line"] == cm.lineCount() - 1) {
        if (cmd_ind == -1) {
        } else if (cmd_ind == cmd_hist.length - 1) {
            cm.setValue(temp_cmd);
            cmd_ind = -1;
        } else {
            cmd_ind += 1
            cm.setValue(cmd_hist[cmd_ind])
        }
    } else {
        cm.setCursor({ "line": cm.getCursor()["line"] + 1, "ch": cm.getCursor()["ch"] })
    }
}

/**
 * Auto completion (Not yet used) ************************
 */

var auto_com_words = null;
function get_dir_returns() {
    // if last command is dir()
    auto_com_words = null;
    var last = serial.getValue().split('\n>>> ');
    last = last[last.length - 2]
    if (last === undefined) {
        return
    }
    if (last.startsWith('dir(')) {
        // get dir result
        last = last.split('[')
        auto_com_words = last[last.length - 1].split(']')[0].split("'").join('').split(',')
        auto_com_words = auto_com_words.map(function (item) {
            return item.trim()
        })
        auto_com_words = auto_com_words.filter(function (item) {
            return item.slice(0, 2) != '__'
        })
    }
    // console.log(auto_com_words)
    // return auto_com_words
}

/**
 * Pusher related
 */

Pusher.logToConsole = true;

// a unique random key generator
function getUniqueId() {
    return 'private-' + Math.random().toString(36).substr(2, 9);
}

// function to get a query param's value
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

var id = getUrlParameter('id');
// var id = 'private-abc123';
if (!id) {
    location.search = location.search
        ? '&id=' + getUniqueId() : 'id=' + getUniqueId();
}

var pusher = new Pusher('f76a627d8d2490ada3c9', {
    cluster: 'us2'
});

var channel = pusher.subscribe(id);

channel.bind('client-check-sender-existence', function () {
    channel.trigger('client-sender-exists', {});
    console.log('client-sender-exists')
})

channel.bind('pusher:subscription_succeeded', function () {
    console.log(channel);
});

channel.bind('client-request-content', function () {
    channel.trigger('client-text-edit', {
        editor: editor.getValue(),
        cursor: editor.getCursor(),
        serial: serial.getValue(),
        command: command.getValue(),
    });
});