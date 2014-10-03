import { React } from '../vendor/react-es6';
import { Container, FileResolver, formatters, fs } from '../vendor/es6-module-transpiler';

export var Editor = React.createClass({
  getInitialState: function() {
    return {
      input: this.props.input,
      format: this.props.format
    };
  },

  render: function() {
    var input = this.state.input;
    var output;
    var error;

    try {
      output = this.buildOutput();
    } catch (ex) {
      if (this._outputEditor) {
        output = this._outputEditor.getValue();
      }
      error = ex.message;
    }

    if (this._outputEditor) {
      this._outputEditor.setValue(output);
    }

    var elements = [
      React.DOM.div({ className: 'input' }, React.DOM.textarea(null, input)),
      React.DOM.div({ className: 'output' }, React.DOM.textarea(null, output)),
      React.DOM.div({ className: 'options' }, [
        React.DOM.label(null, [
          React.DOM.input({
            type: 'radio',
            name: 'format',
            value: 'bundle',
            checked: this.state.format === 'bundle',
            onClick: this.selectFormat
          }),
          'Bundle'
        ]),
        React.DOM.label(null, [
          React.DOM.input({
            type: 'radio',
            name: 'format',
            value: 'commonjs',
            checked: this.state.format === 'commonjs',
            onClick: this.selectFormat
          }),
          'CommonJS'
        ])
      ])
    ];

    if (error) {
      elements.push(
        React.DOM.div({ className: 'error-message' }, error)
      );
    }

    return React.DOM.div(null, elements);
  },

  handleInputChanged: function() {
    var input = this._inputEditor.getValue();
    this.setState({ input: input });

    if (this.props.onInputChange) {
      this.props.onInputChange(input);
    }
  },

  selectFormat: function(event) {
    var format = event.target.value;
    this.setState({ format: format });

    if (this.props.onFormatChange) {
      this.props.onFormatChange(format);
    }
  },

  componentDidMount: function() {
    var element = this.getDOMNode();
    this._inputEditor = this.makeCodeEditor(element.getElementsByClassName('input')[0].firstChild);
    this._outputEditor = this.makeCodeEditor(element.getElementsByClassName('output')[0].firstChild);
    this._inputEditor.on('change', this.handleInputChanged);
  },

  componentWillUnmount: function() {
    this._inputEditor.toTextArea();
    this._outputEditor.toTextArea();
    this._inputEditor.off('change', this.handleInputChanged);
  },

  makeCodeEditor: function(textarea) {
    return CodeMirror.fromTextArea(textarea, {
      lineNumbers: true,
      smartIndent: false,
      indentWithTabs: false,
      tabSize: 2,
      theme: 'default'
    });
  },

  buildOutput: function() {
    var input = this.state.input;
    var format = this.state.format;

    var Dir = fs.root.constructor;
    var out = '/out';

    fs.root = new Dir();
    fs
      .dir('/src')
      .dir(out);

    var files = this.parseFiles(input);
    files.forEach(function(file) {
      fs.file('/src/' + file.filename, file.content);
    });

    var container = new Container({
      formatter: new formatters[format](),
      resolvers: [new FileResolver(['/src'])]
    });

    files.forEach(function(file) {
      container.getModule(file.filename);
    });

    if (format === 'bundle') {
      // Bundle format has one output file.
      container.write(out + '/index.js');
      return fs.readFileSync(out + '/index.js', 'utf8');
    } else {
      // Everything else has multiple output files.
      container.write(out);
      return this.printFiles(out, out);
    }
  },

  printFiles: function(dir, root) {
    var result = '';

    fs.readdirSync(dir).forEach(function(entry) {
      var path = dir + '/' + entry;
      if (fs.statSync(path).isDirectory()) {
        result += this.printFiles(path, root);
      } else if (/\.js$/i.test(path)) {
        result += '// ' + path.replace(root + '/', '') + '\n\n';
        result += fs.readFileSync(path, 'utf8');
        result += '\n\n';
      }
    }.bind(this));

    return result;
  },

  parseFiles: function(source) {
    var result = [];
    var fileLines = [];
    var filename;

    source.split('\n').forEach(function(line) {
      var match = line.match(/^\/\/\s*(.+.js)\s*$/);
      if (match) {
        if (filename) {
          result.push({
            filename: filename,
            content: fileLines.join('\n')
          });
          fileLines = [];
        }
        filename = match[1];
      } else {
        fileLines.push(line);
      }
    });

    if (!filename) {
      filename = 'index.js';
    }

    result.push({
      filename: filename,
      content: fileLines.join('\n')
    });

    return result;
  }
});