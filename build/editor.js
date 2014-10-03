(function() {
    "use strict";
    var $$$vendor$react$es6$$React = window.React;var $$$vendor$es6$module$transpiler$$Container = ModuleTranspiler.Container;
    var $$$vendor$es6$module$transpiler$$FileResolver = ModuleTranspiler.FileResolver;
    var $$$vendor$es6$module$transpiler$$formatters = ModuleTranspiler.formatters;
    var $$$vendor$es6$module$transpiler$$fs = ModuleTranspiler.fs;
    var Editor$$Editor = $$$vendor$react$es6$$React.createClass({
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
          $$$vendor$react$es6$$React.DOM.div({ className: 'input' }, $$$vendor$react$es6$$React.DOM.textarea(null, input)),
          $$$vendor$react$es6$$React.DOM.div({ className: 'output' }, $$$vendor$react$es6$$React.DOM.textarea(null, output)),
          $$$vendor$react$es6$$React.DOM.div({ className: 'options' }, [
            $$$vendor$react$es6$$React.DOM.label(null, [
              $$$vendor$react$es6$$React.DOM.input({
                type: 'radio',
                name: 'format',
                value: 'bundle',
                checked: this.state.format === 'bundle',
                onClick: this.selectFormat
              }),
              'Bundle'
            ]),
            $$$vendor$react$es6$$React.DOM.label(null, [
              $$$vendor$react$es6$$React.DOM.input({
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
            $$$vendor$react$es6$$React.DOM.div({ className: 'error-message' }, error)
          );
        }

        return $$$vendor$react$es6$$React.DOM.div(null, elements);
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

        var Dir = $$$vendor$es6$module$transpiler$$fs.root.constructor;
        var out = '/out';

        $$$vendor$es6$module$transpiler$$fs.root = new Dir();
        $$$vendor$es6$module$transpiler$$fs
          .dir('/src')
          .dir(out);

        var files = this.parseFiles(input);
        files.forEach(function(file) {
          $$$vendor$es6$module$transpiler$$fs.file('/src/' + file.filename, file.content);
        });

        var container = new $$$vendor$es6$module$transpiler$$Container({
          formatter: new $$$vendor$es6$module$transpiler$$formatters[format](),
          resolvers: [new $$$vendor$es6$module$transpiler$$FileResolver(['/src'])]
        });

        files.forEach(function(file) {
          container.getModule(file.filename);
        });

        if (format === 'bundle') {
          // Bundle format has one output file.
          container.write(out + '/index.js');
          return $$$vendor$es6$module$transpiler$$fs.readFileSync(out + '/index.js', 'utf8');
        } else {
          // Everything else has multiple output files.
          container.write(out);
          return this.printFiles(out, out);
        }
      },

      printFiles: function(dir, root) {
        var result = '';

        $$$vendor$es6$module$transpiler$$fs.readdirSync(dir).forEach(function(entry) {
          var path = dir + '/' + entry;
          if ($$$vendor$es6$module$transpiler$$fs.statSync(path).isDirectory()) {
            result += this.printFiles(path, root);
          } else if (/\.js$/i.test(path)) {
            result += '// ' + path.replace(root + '/', '') + '\n\n';
            result += $$$vendor$es6$module$transpiler$$fs.readFileSync(path, 'utf8');
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

    var EditorApp$$DEFAULT_SOURCE = [
      "// segment.js",
      "",
      "export function Segment(start, end) {",
      "  this.start = start;",
      "  this.end = end;",
      "",
      "  this.distance = Math.sqrt(",
      "    Math.pow(start.x - end.x, 2) +",
      "    Math.pow(start.y - end.y, 2)",
      "  );",
      "}",
      "",
      "// point.js",
      "",
      "export function Point(x, y) {",
      "  this.x = x;",
      "  this.y = y;",
      "}",
      "",
      "// index.js",
      "",
      "import { Point } from './point';",
      "import { Segment } from './segment';",
      "",
      "var start = new Point(0, 0);",
      "var end = new Point(4, 5);",
      "",
      "console.log(",
      "  'Distance from origin to (4, 5) is',",
      "  new Segment(start, end).distance",
      ");"
    ].join('\n');

    var EditorApp$$EditorApp = $$$vendor$react$es6$$React.createClass({
      getInitialState: function() {
        var hash = window.location.hash;
        var state;

        if (hash.indexOf('%20')) {
          hash = decodeURIComponent(hash);
        }

        try {
          state = JSON.parse(hash.slice(1));
        } catch (ex) {
          state = {};
        }

        if (!state.format) {
          state.format = 'bundle';
        }
        if (!state.input) {
          state.input = EditorApp$$DEFAULT_SOURCE;
        }

        return state;
      },

      render: function() {
        this.syncHash();

        return $$$vendor$react$es6$$React.DOM.div(null, [
          $$$vendor$react$es6$$React.DOM.h1(null, [
            'ES6 Module Transpiler ',
            $$$vendor$react$es6$$React.DOM.span({ className: 'editor-suffix' }, 'Editor')
          ]),

          Editor$$Editor({
            input: this.state.input,
            format: this.state.format,
            onInputChange: this.handleInputChanged,
            onFormatChange: this.handleFormatChange
          })
        ]);
      },

      handleInputChanged: function(input) {
        this.setState({ input: input });
      },

      handleFormatChange: function(format) {
        this.setState({ format: format });
      },

      syncHash: function() {
        var state = this.state;
        window.location.hash = '#' + JSON.stringify(state);
      }
    });

    $$$vendor$react$es6$$React.renderComponent(EditorApp$$EditorApp(null), document.getElementById('body'));
}).call(this);

//# sourceMappingURL=editor.js.map