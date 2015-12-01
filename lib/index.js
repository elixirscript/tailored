"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.make_case = exports.Case = exports.bound = exports.type = exports.headTail = exports.capture = exports.startsWith = exports.wildcard = exports.variable = exports.match_no_throw = exports.MatchError = exports.match = exports.defmatch = undefined;

var _defmatch = require("./tailored/defmatch");

var _types = require("./tailored/types");

exports.defmatch = _defmatch.defmatch;
exports.match = _defmatch.match;
exports.MatchError = _defmatch.MatchError;
exports.match_no_throw = _defmatch.match_no_throw;
exports.variable = _types.variable;
exports.wildcard = _types.wildcard;
exports.startsWith = _types.startsWith;
exports.capture = _types.capture;
exports.headTail = _types.headTail;
exports.type = _types.type;
exports.bound = _types.bound;
exports.Case = _defmatch.Case;
exports.make_case = _defmatch.make_case;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O1FBS0UsUUFBUSxhQUxELFFBQVE7UUFLTCxLQUFLLGFBTEUsS0FBSztRQUtMLFVBQVUsYUFMSCxVQUFVO1FBS0wsY0FBYyxhQUxQLGNBQWM7UUFNbEQsUUFBUSxVQUxELFFBQVE7UUFLTCxRQUFRLFVBTEQsUUFBUTtRQUtMLFVBQVUsVUFMSCxVQUFVO1FBTXJDLE9BQU8sVUFOZ0MsT0FBTztRQU1yQyxRQUFRLFVBTitCLFFBQVE7UUFNckMsSUFBSSxVQU5tQyxJQUFJO1FBTXJDLEtBQUssVUFOa0MsS0FBSztRQU1yQyxJQUFJLGFBUGdCLElBQUk7UUFPbEIsU0FBUyxhQVBXLFNBQVMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWZtYXRjaCwgbWF0Y2gsIE1hdGNoRXJyb3IsIG1hdGNoX25vX3Rocm93LCBDYXNlLCBtYWtlX2Nhc2UgfSBmcm9tIFwiLi90YWlsb3JlZC9kZWZtYXRjaFwiO1xuaW1wb3J0IHsgdmFyaWFibGUsIHdpbGRjYXJkLCBzdGFydHNXaXRoLCBjYXB0dXJlLCBoZWFkVGFpbCwgdHlwZSwgYm91bmQgfSBmcm9tIFwiLi90YWlsb3JlZC90eXBlc1wiO1xuXG5cbmV4cG9ydCB7XG4gIGRlZm1hdGNoLCBtYXRjaCwgTWF0Y2hFcnJvciwgbWF0Y2hfbm9fdGhyb3csXG4gIHZhcmlhYmxlLCB3aWxkY2FyZCwgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSwgaGVhZFRhaWwsIHR5cGUsIGJvdW5kLCBDYXNlLCBtYWtlX2Nhc2Vcbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
