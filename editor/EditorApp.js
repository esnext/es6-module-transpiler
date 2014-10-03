import { React } from '../vendor/react-es6';
import { Editor } from './Editor';

var DEFAULT_SOURCE = [
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

export var EditorApp = React.createClass({
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
      state.input = DEFAULT_SOURCE;
    }

    return state;
  },

  render: function() {
    this.syncHash();

    return React.DOM.div(null, [
      React.DOM.h1(null, [
        'ES6 Module Transpiler ',
        React.DOM.span({ className: 'editor-suffix' }, 'Editor')
      ]),

      Editor({
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