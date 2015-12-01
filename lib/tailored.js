'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Variable = function Variable() {
  var name = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

  _classCallCheck(this, Variable);

  this.name = name;
};

var Wildcard = function Wildcard() {
  _classCallCheck(this, Wildcard);
};

var StartsWith = function StartsWith(prefix) {
  _classCallCheck(this, StartsWith);

  this.prefix = prefix;
};

var Capture = function Capture(value) {
  _classCallCheck(this, Capture);

  this.value = value;
};

var HeadTail = function HeadTail() {
  _classCallCheck(this, HeadTail);
};

var Type = function Type(type) {
  var objPattern = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  _classCallCheck(this, Type);

  this.type = type;
  this.objPattern = objPattern;
};

var Bound = function Bound(value) {
  _classCallCheck(this, Bound);

  this.value = value;
};

function variable() {
  var name = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

  return new Variable(name);
}

function wildcard() {
  return new Wildcard();
}

function startsWith(prefix) {
  return new StartsWith(prefix);
}

function capture(value) {
  return new Capture(value);
}

function headTail() {
  return new HeadTail();
}

function type(type) {
  var objPattern = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  return new Type(type, objPattern);
}

function bound(value) {
  return new Bound(value);
}

function is_number(value) {
  return typeof value === 'number';
}

function is_string(value) {
  return typeof value === 'string';
}

function is_boolean(value) {
  return typeof value === 'boolean';
}

function is_symbol(value) {
  return (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'symbol';
}

function is_null(value) {
  return value === null;
}

function is_undefined(value) {
  return typeof value === 'undefined';
}

function is_variable(value) {
  return value instanceof Variable;
}

function is_wildcard(value) {
  return value instanceof Wildcard;
}

function is_headTail(value) {
  return value instanceof HeadTail;
}

function is_capture(value) {
  return value instanceof Capture;
}

function is_type(value) {
  return value instanceof Type;
}

function is_startsWith(value) {
  return value instanceof StartsWith;
}

function is_bound(value) {
  return value instanceof Bound;
}

function is_object(value) {
  return (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object';
}

function is_array(value) {
  return Array.isArray(value);
}

function resolveSymbol(pattern) {
  return function (value) {
    return is_symbol(value) && value === pattern;
  };
}

function resolveString(pattern) {
  return function (value) {
    return is_string(value) && value === pattern;
  };
}

function resolveNumber(pattern) {
  return function (value) {
    return is_number(value) && value === pattern;
  };
}

function resolveBoolean(pattern) {
  return function (value) {
    return is_boolean(value) && value === pattern;
  };
}

function resolveNull(pattern) {
  return function (value) {
    return is_null(value);
  };
}

function resolveBound(pattern) {
  return function (value, args) {
    if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === _typeof(pattern.value) && value === pattern.value) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveWildcard() {
  return function () {
    return true;
  };
}

function resolveVariable() {
  return function (value, args) {
    args.push(value);
    return true;
  };
}

function resolveHeadTail() {
  return function (value, args) {
    if (!is_array(value) || value.length < 2) {
      return false;
    }

    var head = value[0];
    var tail = value.slice(1);

    args.push(head);
    args.push(tail);

    return true;
  };
}

function resolveCapture(pattern) {
  var matches = buildMatch(pattern.value);

  return function (value, args) {
    if (matches(value, args)) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveStartsWith(pattern) {
  var prefix = pattern.prefix;

  return function (value, args) {
    if (is_string(value) && value.startsWith(prefix)) {
      args.push(value.substring(prefix.length));
      return true;
    }

    return false;
  };
}

function resolveType(pattern) {
  return function (value, args) {
    if (value instanceof pattern.type) {
      var matches = buildMatch(pattern.objPattern);
      return matches(value, args) && args.push(value) > 0;
    }

    return false;
  };
}

function resolveArray(pattern) {
  var matches = pattern.map(function (x) {
    return buildMatch(x);
  });

  return function (value, args) {
    if (!is_array(value) || value.length != pattern.length) {
      return false;
    }

    return value.every(function (v, i) {
      return matches[i](value[i], args);
    });
  };
}

function resolveObject(pattern) {
  var matches = {};

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = Object.keys(pattern)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      matches[key] = buildMatch(pattern[key]);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return function (value, args) {
    if (!is_object(value) || pattern.length > value.length) {
      return false;
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = Object.keys(pattern)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var key = _step2.value;

        if (!(key in value) || !matches[key](value[key], args)) {
          return false;
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return true;
  };
}

function resolveNoMatch() {
  return function () {
    return false;
  };
}

function buildMatch(pattern) {

  if (is_variable(pattern)) {
    return resolveVariable(pattern);
  }

  if (is_wildcard(pattern)) {
    return resolveWildcard(pattern);
  }

  if (is_undefined(pattern)) {
    return resolveWildcard(pattern);
  }

  if (is_headTail(pattern)) {
    return resolveHeadTail(pattern);
  }

  if (is_startsWith(pattern)) {
    return resolveStartsWith(pattern);
  }

  if (is_capture(pattern)) {
    return resolveCapture(pattern);
  }

  if (is_bound(pattern)) {
    return resolveBound(pattern);
  }

  if (is_type(pattern)) {
    return resolveType(pattern);
  }

  if (is_array(pattern)) {
    return resolveArray(pattern);
  }

  if (is_number(pattern)) {
    return resolveNumber(pattern);
  }

  if (is_string(pattern)) {
    return resolveString(pattern);
  }

  if (is_boolean(pattern)) {
    return resolveBoolean(pattern);
  }

  if (is_symbol(pattern)) {
    return resolveSymbol(pattern);
  }

  if (is_null(pattern)) {
    return resolveNull(pattern);
  }

  if (is_object(pattern)) {
    return resolveObject(pattern);
  }

  return resolveNoMatch();
}

var MatchError = (function (_Error) {
  _inherits(MatchError, _Error);

  function MatchError(arg) {
    _classCallCheck(this, MatchError);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(MatchError).call(this));

    if ((typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'symbol') {
      _this.message = 'No match for: ' + arg.toString();
    } else if (Array.isArray(arg)) {
      var mappedValues = arg.map(function (x) {
        return x.toString();
      });
      _this.message = 'No match for: ' + mappedValues;
    } else {
      _this.message = 'No match for: ' + arg;
    }

    _this.stack = new Error().stack;
    _this.name = _this.constructor.name;
    return _this;
  }

  return MatchError;
})(Error);

var Clause = function Clause(pattern, fn) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  _classCallCheck(this, Clause);

  this.pattern = buildMatch(pattern);
  this.fn = fn;
  this.guard = guard;
};

function clause(pattern, fn) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  return new Clause(pattern, fn, guard);
}

function defmatch() {
  for (var _len = arguments.length, clauses = Array(_len), _key = 0; _key < _len; _key++) {
    clauses[_key] = arguments[_key];
  }

  return function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (var _iterator3 = clauses[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
        var processedClause = _step3.value;

        var result = [];
        if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
          return processedClause.fn.apply(this, result);
        }
      }
    } catch (err) {
      _didIteratorError3 = true;
      _iteratorError3 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion3 && _iterator3.return) {
          _iterator3.return();
        }
      } finally {
        if (_didIteratorError3) {
          throw _iteratorError3;
        }
      }
    }

    throw new MatchError(args);
  };
}

function match(pattern, expr) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  var result = [];
  var processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    throw new MatchError(expr);
  }
}

exports.defmatch = defmatch;
exports.match = match;
exports.MatchError = MatchError;
exports.variable = variable;
exports.wildcard = wildcard;
exports.startsWith = startsWith;
exports.capture = capture;
exports.headTail = headTail;
exports.type = type;
exports.bound = bound;
exports.Clause = Clause;
exports.clause = clause;
//# sourceMappingURL=data:application/json;base64,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cmNlc0NvbnRlbnQiOlsiY2xhc3MgVmFyaWFibGUge1xuXG4gIGNvbnN0cnVjdG9yKG5hbWUgPSBudWxsKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge31cbn1cblxuY2xhc3MgU3RhcnRzV2l0aCB7XG5cbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG5cbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgSGVhZFRhaWwge1xuICBjb25zdHJ1Y3RvcigpIHt9XG59XG5cbmNsYXNzIFR5cGUge1xuXG4gIGNvbnN0cnVjdG9yKHR5cGUsIG9ialBhdHRlcm4gPSB7fSkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5vYmpQYXR0ZXJuID0gb2JqUGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBCb3VuZCB7XG5cbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUobmFtZSA9IG51bGwpIHtcbiAgcmV0dXJuIG5ldyBWYXJpYWJsZShuYW1lKTtcbn1cblxuZnVuY3Rpb24gd2lsZGNhcmQoKSB7XG4gIHJldHVybiBuZXcgV2lsZGNhcmQoKTtcbn1cblxuZnVuY3Rpb24gc3RhcnRzV2l0aChwcmVmaXgpIHtcbiAgcmV0dXJuIG5ldyBTdGFydHNXaXRoKHByZWZpeCk7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBDYXB0dXJlKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gaGVhZFRhaWwoKSB7XG4gIHJldHVybiBuZXcgSGVhZFRhaWwoKTtcbn1cblxuZnVuY3Rpb24gdHlwZSh0eXBlLCBvYmpQYXR0ZXJuID0ge30pIHtcbiAgcmV0dXJuIG5ldyBUeXBlKHR5cGUsIG9ialBhdHRlcm4pO1xufVxuXG5mdW5jdGlvbiBib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gbmV3IEJvdW5kKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gaXNfbnVtYmVyKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc19zdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG5cbmZ1bmN0aW9uIGlzX2Jvb2xlYW4odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nO1xufVxuXG5mdW5jdGlvbiBpc19zeW1ib2wodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCc7XG59XG5cbmZ1bmN0aW9uIGlzX251bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc191bmRlZmluZWQodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIGlzX3ZhcmlhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFZhcmlhYmxlO1xufVxuXG5mdW5jdGlvbiBpc193aWxkY2FyZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXaWxkY2FyZDtcbn1cblxuZnVuY3Rpb24gaXNfaGVhZFRhaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSGVhZFRhaWw7XG59XG5cbmZ1bmN0aW9uIGlzX2NhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ2FwdHVyZTtcbn1cblxuZnVuY3Rpb24gaXNfdHlwZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBUeXBlO1xufVxuXG5mdW5jdGlvbiBpc19zdGFydHNXaXRoKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFN0YXJ0c1dpdGg7XG59XG5cbmZ1bmN0aW9uIGlzX2JvdW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJvdW5kO1xufVxuXG5mdW5jdGlvbiBpc19vYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG5cbmZ1bmN0aW9uIGlzX2FycmF5KHZhbHVlKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN5bWJvbChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gaXNfc3ltYm9sKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0cmluZyhwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gaXNfbnVtYmVyKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvb2xlYW4ocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgcmV0dXJuIGlzX2Jvb2xlYW4odmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTnVsbChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gaXNfbnVsbCh2YWx1ZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb3VuZChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSB0eXBlb2YgcGF0dGVybi52YWx1ZSAmJiB2YWx1ZSA9PT0gcGF0dGVybi52YWx1ZSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVmFyaWFibGUoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIWlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZCA9IHZhbHVlWzBdO1xuICAgIGNvbnN0IHRhaWwgPSB2YWx1ZS5zbGljZSgxKTtcblxuICAgIGFyZ3MucHVzaChoZWFkKTtcbiAgICBhcmdzLnB1c2godGFpbCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNhcHR1cmUocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLnZhbHVlKTtcblxuICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKG1hdGNoZXModmFsdWUsIGFyZ3MpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKSB7XG4gIGNvbnN0IHByZWZpeCA9IHBhdHRlcm4ucHJlZml4O1xuXG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZS5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpIHtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFpc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoICE9IHBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uICh2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGZvciAobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKSkge1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIWlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmtleXMocGF0dGVybikpIHtcbiAgICAgIGlmICghKGtleSBpbiB2YWx1ZSkgfHwgIW1hdGNoZXNba2V5XSh2YWx1ZVtrZXldLCBhcmdzKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOb01hdGNoKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG5cbiAgaWYgKGlzX3ZhcmlhYmxlKHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc193aWxkY2FyZChwYXR0ZXJuKSkge1xuICAgIHJldHVybiByZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZiAoaXNfdW5kZWZpbmVkKHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc19oZWFkVGFpbChwYXR0ZXJuKSkge1xuICAgIHJldHVybiByZXNvbHZlSGVhZFRhaWwocGF0dGVybik7XG4gIH1cblxuICBpZiAoaXNfc3RhcnRzV2l0aChwYXR0ZXJuKSkge1xuICAgIHJldHVybiByZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc19jYXB0dXJlKHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVDYXB0dXJlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKGlzX2JvdW5kKHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVCb3VuZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc190eXBlKHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVUeXBlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKGlzX2FycmF5KHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVBcnJheShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc19udW1iZXIocGF0dGVybikpIHtcbiAgICByZXR1cm4gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc19zdHJpbmcocGF0dGVybikpIHtcbiAgICByZXR1cm4gcmVzb2x2ZVN0cmluZyhwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmIChpc19ib29sZWFuKHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKGlzX3N5bWJvbChwYXR0ZXJuKSkge1xuICAgIHJldHVybiByZXNvbHZlU3ltYm9sKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKGlzX251bGwocGF0dGVybikpIHtcbiAgICByZXR1cm4gcmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZiAoaXNfb2JqZWN0KHBhdHRlcm4pKSB7XG4gICAgcmV0dXJuIHJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gcmVzb2x2ZU5vTWF0Y2goKTtcbn1cblxuY2xhc3MgTWF0Y2hFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoYXJnKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnc3ltYm9sJykge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICBsZXQgbWFwcGVkVmFsdWVzID0gYXJnLm1hcCh4ID0+IHgudG9TdHJpbmcoKSk7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuY2xhc3MgQ2xhdXNlIHtcblxuICBjb25zdHJ1Y3RvcihwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmZ1bmN0aW9uIGRlZm1hdGNoKC4uLmNsYXVzZXMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGlmIChwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpICYmIHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKSB7XG4gICAgICAgIHJldHVybiBwcm9jZXNzZWRDbGF1c2UuZm4uYXBwbHkodGhpcywgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWF0Y2gocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBpZiAocHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpICYmIGd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmV4cG9ydCB7IGRlZm1hdGNoLCBtYXRjaCwgTWF0Y2hFcnJvciwgdmFyaWFibGUsIHdpbGRjYXJkLCBzdGFydHNXaXRoLCBjYXB0dXJlLCBoZWFkVGFpbCwgdHlwZSwgYm91bmQsIENsYXVzZSwgY2xhdXNlIH07Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
